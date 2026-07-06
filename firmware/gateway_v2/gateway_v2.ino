/*
 * ============================================================
 * Ovelhinha — Gateway ESP32-C3  (v2 — Captive Portal Wi-Fi)
 * ============================================================
 *
 * DIFERENÇAS EM RELAÇÃO AO gateway-esp32 ORIGINAL (v1):
 *   - Não há config.h. SSID, senha e número do gateway são
 *     configurados via captive portal na primeira inicialização.
 *   - As credenciais são salvas na NVS (flash) via Preferences.
 *   - O UUID do gateway é registrado/descoberto automaticamente
 *     no Supabase após o primeiro boot e também gravado na NVS.
 *   - Toda a lógica BLE, UUIDs, comandos e LED é IDÊNTICA ao v1.
 *
 * PRIMEIRO BOOT (sem configuração):
 *   1. ESP32 sobe em modo AP com o nome "Ovelhinha-GW".
 *   2. Abra o Wi-Fi do celular e conecte em "Ovelhinha-GW".
 *   3. O browser abre automaticamente (ou acesse 192.168.4.1).
 *   4. Preencha: SSID da rede, Senha, Número do Gateway (1–9).
 *   5. Salve — o ESP32 reinicia e conecta normalmente.
 *
 * RESETAR CONFIGURAÇÕES (botão BOOT = GPIO 9):
 *   Segure o botão BOOT por 3 segundos ao ligar → LED branco
 *   piscará → NVS apagada → portal de configuração reabrirá.
 *
 * DEPENDÊNCIAS (instalar via Library Manager do Arduino IDE):
 *   - NimBLE-Arduino by h2zero
 *   - ArduinoJson by Benoit Blanchon (v7.x)
 *   - WiFiManager by tzapu  ← NOVO em relação ao v1
 *   WiFi.h, HTTPClient.h, Preferences.h são built-in do ESP32.
 *
 * PLACA: ESP32-C3 Super Mini
 * Board Manager URL: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 * Board: ESP32C3 Dev Module
 * Partition Scheme: Huge APP (3MB No OTA/1MB SPIFFS) — obrigatório
 *
 * ============================================================
 * SQL DE MIGRAÇÃO — rodar no Supabase SQL Editor
 * ============================================================
 *
 * -- Tabela de comandos do gateway
 * CREATE TABLE IF NOT EXISTS gateway_commands (
 *   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
 *   bracelet_id UUID NOT NULL REFERENCES bracelets(id) ON DELETE CASCADE,
 *   command     TEXT NOT NULL CHECK (command IN ('acionar', 'encerrar')),
 *   reason      TEXT,
 *   status      TEXT NOT NULL DEFAULT 'pending'
 *                 CHECK (status IN ('pending', 'sent', 'failed')),
 *   attempts    INTEGER NOT NULL DEFAULT 0,
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   sent_at     TIMESTAMPTZ
 * );
 *
 * -- Tabela de gateways registrados
 * CREATE TABLE IF NOT EXISTS gateways (
 *   id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   church_id  UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
 *   name       TEXT NOT NULL DEFAULT 'Gateway-01',
 *   last_seen  TIMESTAMPTZ
 * );
 *
 * -- Adiciona esp_id em bracelets (MAC BLE lowercase, ex: "a4:b2:c1:d3:e5:f6")
 * ALTER TABLE bracelets ADD COLUMN IF NOT EXISTS esp_id TEXT;
 *
 * -- Índices
 * CREATE INDEX IF NOT EXISTS idx_gw_commands_pending
 *   ON gateway_commands(church_id, status, created_at)
 *   WHERE status = 'pending';
 *
 * CREATE INDEX IF NOT EXISTS idx_gateways_church
 *   ON gateways(church_id);
 *
 * -- RLS
 * ALTER TABLE gateway_commands ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE gateways         ENABLE ROW LEVEL SECURITY;
 *
 * DO $$ BEGIN
 *   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gateway_commands' AND policyname='anon_all_gateway_commands') THEN
 *     CREATE POLICY "anon_all_gateway_commands" ON gateway_commands FOR ALL TO anon USING (true) WITH CHECK (true);
 *   END IF;
 *   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gateways' AND policyname='anon_all_gateways') THEN
 *     CREATE POLICY "anon_all_gateways" ON gateways FOR ALL TO anon USING (true) WITH CHECK (true);
 *   END IF;
 * END $$;
 *
 * -- GRANTs
 * GRANT SELECT, INSERT, UPDATE, DELETE ON gateway_commands TO anon;
 * GRANT SELECT, INSERT, UPDATE, DELETE ON gateways         TO anon;
 *
 * ============================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <WiFiManager.h>  // by tzapu — instalar via Library Manager
#include <time.h>

// ============================================================
// CONSTANTES DE COMPILAÇÃO — iguais em todos os gateways
// ============================================================
#define SUPABASE_URL  "https://reefzadzwbmhkojtjqhz.supabase.co"
#define SUPABASE_KEY  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZWZ6YWR6d2JtaGtvanRqcWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzUzNDksImV4cCI6MjA5MDgxMTM0OX0.RoAIEJoJT31EdmkjA_3LeyDdiw9f9uK0GuJd2OvfQ_E"
#define CHURCH_ID     "00000000-0000-0000-0000-000000000001"

// ============================================================
// TIMINGS (iguais ao v1)
// ============================================================
#define POLL_INTERVAL_MS   2000
#define HEARTBEAT_MS      30000
#define WIFI_CHECK_MS     10000
#define WIFI_TIMEOUT_MS   30000
#define WIFI_RESTART_MS   60000
#define BLE_SCAN_TIMEOUT   8000   // ms
#define BLE_MAX_ATTEMPTS   3

// UUIDs BLE (devem coincidir com o firmware das pulseiras)
#define SERVICE_UUID  "12345678-1234-1234-1234-123456789012"
#define CHAR_UUID     "87654321-4321-4321-4321-210987654321"

// ============================================================
// PINOS LED (ânodo comum: LOW=acende, HIGH=apaga)
// ============================================================
#define PIN_R 2
#define PIN_G 3
#define PIN_B 4

// ============================================================
// BOTÃO DE RESET DE CONFIGURAÇÃO
// GPIO 9 = botão BOOT físico do ESP32-C3 Super Mini (pull-up interno)
// Segurar ≥ 3 s durante o boot apaga NVS e reabre o portal.
// ============================================================
#define RESET_BTN_PIN 9

// ============================================================
// FILA DE COMANDOS
// ============================================================
#define QUEUE_SIZE    20
#define MAX_BRACELETS 150

struct QueueItem {
  char id[37];           // UUID do gateway_command
  char bracelet_id[37];  // UUID da pulseira
  char esp_id[18];       // MAC BLE lowercase "aa:bb:cc:dd:ee:ff"
  char command[10];      // "acionar" | "encerrar"
  char reason[20];       // nullable — string vazia se null
  uint8_t attempts;
};

struct BraceletMap {
  char id[37];    // UUID
  char esp_id[18]; // MAC lowercase
};

// ============================================================
// ESTADO DO LED (não-bloqueante)
// ============================================================
enum LedMode {
  LED_OFF,
  LED_GREEN,
  LED_GREEN_BLINK, // verde piscando lento — gateway pronto/idle
  LED_RED_SOLID,
  LED_RED_BLINK,
  LED_BLUE_BLINK,
  LED_WHITE_PULSE,
  LED_RED_PULSE
};

// ============================================================
// ESTADO BLE (máquina de estados)
// ============================================================
enum BLEExecState {
  BLE_EXEC_IDLE,
  BLE_EXEC_SCANNING,
  BLE_EXEC_CONNECTING,
  BLE_EXEC_DONE,
  BLE_EXEC_FAILED
};

// ============================================================
// VARIÁVEIS GLOBAIS
// ============================================================

// Configuração lida da NVS (populada por setupWiFi / loadConfigFromNVS)
int  gwNum = 0;                    // número do gateway (1–9)
char gatewayName[20] = "";         // ex: "Gateway-01"
char gatewayId[37]   = "";         // UUID do registro em gateways (Supabase)

// Fila circular
QueueItem  commandQueue[QUEUE_SIZE];
int        queueHead  = 0;
int        queueTail  = 0;
int        queueCount = 0;

// Mapa pulseiras
BraceletMap bracelets[MAX_BRACELETS];
int         braceletCount = 0;

// Timers
unsigned long lastPoll      = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastWifiCheck = 0;
unsigned long wifiLostAt    = 0;
unsigned long bleGraceUntil = 0; // período de graça após BLE — não mostrar vermelho
bool          wifiWasLost   = false;

// Estado BLE
BLEExecState  bleExecState  = BLE_EXEC_IDLE;
QueueItem     activeItem;
bool          bleOccupied   = false;
bool          deviceFound   = false;
bool          scanEnded     = false;
unsigned long bleScanStart  = 0;
NimBLEAddress foundAddress;

// Estado LED
LedMode       currentLedMode = LED_OFF;
unsigned long ledLastToggle  = 0;
bool          ledBlinkState  = false;
int           pulseCount     = 0;
int           pulseTarget    = 0;

// Ponteiro global para parâmetro customizado do WiFiManager
// (necessário para acessá-lo no callback de save sem captura)
static WiFiManagerParameter* g_gwNumParam = nullptr;

// ============================================================
// BLE SCAN CALLBACKS
// ============================================================
class GatewayScanCallbacks : public NimBLEScanCallbacks {
public:
  char targetMAC[18]; // MAC alvo em lowercase

  void onResult(const NimBLEAdvertisedDevice* device) override {
    // NimBLE retorna MAC em uppercase — converte para comparar
    String addr = String(device->getAddress().toString().c_str());
    addr.toLowerCase();
    Serial.printf("[BLE] Encontrado: %s (RSSI: %d)\n", addr.c_str(), device->getRSSI());
    if (addr.equals(String(targetMAC))) {
      Serial.printf("[BLE] Alvo encontrado: %s\n", targetMAC);
      foundAddress = device->getAddress();  // copia endereço + tipo antes do scan limpar
      deviceFound  = true;
      // NÃO chamar stop() aqui — chamar stop() de dentro do callback corromperia o BLE stack
      // O loop principal (doConnectAndSend) chama stop() após detectar deviceFound=true
    }
  }

  void onScanEnd(const NimBLEScanResults& results, int reason) override {
    scanEnded = true;
    Serial.println("[BLE] Scan encerrado");
  }
} scanCallbacks;

// ============================================================
// PROTÓTIPOS
// ============================================================
void     setColor(int r, int g, int b);
void     setLedMode(LedMode mode, int pulses = 0);
void     updateLed();
uint8_t  reasonToByte(const char* command, const char* reason);
void     toLowerStr(char* s);
String   getISOTime();
bool     enqueue(QueueItem item);
bool     dequeue(QueueItem& item);
void     requeue(QueueItem item);
bool     containsId(const char* id);
bool     isFull();
bool     isEmpty();
void     loadBracelets();
bool     resolveEspId(const char* bracelet_id, char* out_esp_id);
void     checkResetButton();
void     loadConfigFromNVS();
void     onSaveParamsCallback();
void     setupWiFi();
void     ensureGatewayRegistered();
void     pollCommands();
void     heartbeat();
bool     isCommandStillPending(const char* id);
void     patchCommandStatus(const char* id, const char* status);
void     processQueue();
void     startBLEExec(QueueItem& item);
void     tickBLE();
bool     doConnectAndSend();
String   httpGet(const char* url);
bool     httpPatch(const char* url, const char* body);
bool     httpPost(const char* url, const char* body);
void     syncNTP();

// ============================================================
// LED
// ============================================================
void setColor(int r, int g, int b) {
  // Ânodo comum: LOW = acende, HIGH = apaga
  digitalWrite(PIN_R, r > 0 ? LOW : HIGH);
  digitalWrite(PIN_G, g > 0 ? LOW : HIGH);
  digitalWrite(PIN_B, b > 0 ? LOW : HIGH);
}

void setLedMode(LedMode mode, int pulses) {
  currentLedMode = mode;
  pulseCount     = 0;
  pulseTarget    = pulses;
  ledBlinkState  = false;
  ledLastToggle  = millis();

  switch (mode) {
    case LED_GREEN:     setColor(0, 1, 0); break;
    case LED_RED_SOLID: setColor(1, 0, 0); break;
    case LED_OFF:       setColor(0, 0, 0); break;
    default: break; // piscantes tratados em updateLed()
  }
}

void updateLed() {
  // Modos estáticos não precisam de update
  if (currentLedMode == LED_OFF ||
      currentLedMode == LED_GREEN ||
      currentLedMode == LED_RED_SOLID) return;

  unsigned long now = millis();
  unsigned long interval;

  switch (currentLedMode) {
    case LED_GREEN_BLINK: interval = ledBlinkState ? 80 : 1800; break; // flash rápido + pausa longa — idle
    case LED_BLUE_BLINK:  interval = 300;  break;
    case LED_RED_BLINK:   interval = 500;  break;
    default:              interval = 120;  break; // pulsos rápidos
  }

  if (now - ledLastToggle < interval) return;
  ledLastToggle = now;
  ledBlinkState = !ledBlinkState;

  switch (currentLedMode) {
    case LED_GREEN_BLINK:
      setColor(0, ledBlinkState ? 1 : 0, 0);
      break;

    case LED_BLUE_BLINK:
      setColor(0, 0, ledBlinkState ? 1 : 0);
      break;

    case LED_RED_BLINK:
      setColor(ledBlinkState ? 1 : 0, 0, 0);
      break;

    case LED_WHITE_PULSE:
      if (ledBlinkState) {
        setColor(1, 1, 1);
      } else {
        setColor(0, 0, 0);
        pulseCount++;
        if (pulseTarget > 0 && pulseCount >= pulseTarget) {
          setLedMode(LED_GREEN_BLINK);
        }
      }
      break;

    case LED_RED_PULSE:
      if (ledBlinkState) {
        setColor(1, 0, 0);
      } else {
        setColor(0, 0, 0);
        pulseCount++;
        if (pulseTarget > 0 && pulseCount >= pulseTarget) {
          setLedMode(LED_GREEN_BLINK);
        }
      }
      break;

    default: break;
  }
}

// ============================================================
// UTILITÁRIOS
// ============================================================
uint8_t reasonToByte(const char* command, const char* reason) {
  if (strcmp(command, "encerrar") == 0)       return 0x00;
  if (strcmp(reason,  "Urgência") == 0)       return 0x01;
  if (strcmp(reason,  "Banheiro") == 0)       return 0x02;
  if (strcmp(reason,  "Chorando") == 0)       return 0x03;
  if (strcmp(reason,  "Passando mal") == 0)   return 0x03;
  if (strcmp(reason,  "Amamentação") == 0)    return 0x03;
  if (strcmp(reason,  "Outro") == 0)          return 0x04;
  return 0x01; // fallback: urgência
}

void toLowerStr(char* s) {
  for (int i = 0; s[i]; i++) s[i] = tolower((unsigned char)s[i]);
}

void syncNTP() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo;
  int attempts = 0;
  while (!getLocalTime(&timeinfo) && attempts < 10) {
    delay(500);
    attempts++;
  }
  if (attempts < 10) {
    Serial.println("[BOOT] NTP sincronizado");
  } else {
    Serial.println("[BOOT] NTP falhou — timestamps podem ser imprecisos");
  }
}

String getISOTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "1970-01-01T00:00:00Z";
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// ============================================================
// FILA CIRCULAR
// ============================================================
bool isFull()  { return queueCount >= QUEUE_SIZE; }
bool isEmpty() { return queueCount == 0; }

bool containsId(const char* id) {
  for (int i = 0; i < queueCount; i++) {
    int idx = (queueHead + i) % QUEUE_SIZE;
    if (strcmp(commandQueue[idx].id, id) == 0) return true;
  }
  return false;
}

bool enqueue(QueueItem item) {
  if (isFull()) {
    Serial.println("[QUEUE] Fila cheia — comando descartado");
    return false;
  }
  commandQueue[queueTail] = item;
  queueTail = (queueTail + 1) % QUEUE_SIZE;
  queueCount++;
  Serial.printf("[QUEUE] Enfileirado: %s | %s | tentativas: %d\n",
    item.command, item.bracelet_id, item.attempts);
  return true;
}

bool dequeue(QueueItem& item) {
  if (isEmpty()) return false;
  item = commandQueue[queueHead];
  queueHead = (queueHead + 1) % QUEUE_SIZE;
  queueCount--;
  return true;
}

void requeue(QueueItem item) {
  if (!isFull()) {
    commandQueue[queueTail] = item;
    queueTail = (queueTail + 1) % QUEUE_SIZE;
    queueCount++;
    Serial.printf("[QUEUE] Recolocado na fila (tentativa %d): %s\n",
      item.attempts, item.bracelet_id);
  }
}

// ============================================================
// MAPA DE PULSEIRAS
// ============================================================
void loadBracelets() {
  Serial.println("[HTTP] Carregando mapa de pulseiras...");
  String url = String(SUPABASE_URL)
    + "/rest/v1/bracelets?church_id=eq." + CHURCH_ID
    + "&select=id,esp_id&esp_id=not.is.null";

  String response = httpGet(url.c_str());
  if (response.isEmpty()) {
    Serial.println("[HTTP] Falha ao carregar pulseiras");
    return;
  }

  JsonDocument doc;
  if (deserializeJson(doc, response)) {
    Serial.println("[HTTP] JSON de pulseiras inválido");
    return;
  }

  braceletCount = 0;
  for (JsonObject b : doc.as<JsonArray>()) {
    if (braceletCount >= MAX_BRACELETS) break;
    const char* bid    = b["id"];
    const char* esp_id = b["esp_id"];
    if (!bid || !esp_id || strlen(esp_id) == 0) continue;
    strlcpy(bracelets[braceletCount].id,     bid,    37);
    strlcpy(bracelets[braceletCount].esp_id, esp_id, 18);
    toLowerStr(bracelets[braceletCount].esp_id); // garante lowercase
    braceletCount++;
  }
  Serial.printf("[HTTP] %d pulseiras com esp_id mapeadas\n", braceletCount);
}

bool resolveEspId(const char* bracelet_id, char* out_esp_id) {
  // 1. Busca no cache em memória (pulseiras conhecidas no boot)
  for (int i = 0; i < braceletCount; i++) {
    if (strcmp(bracelets[i].id, bracelet_id) == 0) {
      strlcpy(out_esp_id, bracelets[i].esp_id, 18);
      return true;
    }
  }

  // 2. Não encontrou — pulseira adicionada após o boot. Busca direto no Supabase.
  Serial.printf("[HTTP] bracelet_id %s não está no cache — buscando no Supabase...\n", bracelet_id);
  String url = String(SUPABASE_URL)
    + "/rest/v1/bracelets?id=eq." + bracelet_id
    + "&select=id,esp_id&esp_id=not.is.null&limit=1";

  String response = httpGet(url.c_str());
  if (response.isEmpty() || response == "[]") return false;

  JsonDocument doc;
  if (deserializeJson(doc, response)) return false;

  JsonArray arr = doc.as<JsonArray>();
  if (arr.size() == 0) return false;

  const char* esp_id = arr[0]["esp_id"];
  if (!esp_id || strlen(esp_id) == 0) return false;

  strlcpy(out_esp_id, esp_id, 18);
  toLowerStr(out_esp_id);

  // 3. Adiciona ao cache para evitar nova requisição nos próximos comandos
  if (braceletCount < MAX_BRACELETS) {
    strlcpy(bracelets[braceletCount].id,     bracelet_id, 37);
    strlcpy(bracelets[braceletCount].esp_id, out_esp_id,  18);
    braceletCount++;
    Serial.printf("[HTTP] Nova pulseira adicionada ao cache: %s → %s\n", bracelet_id, out_esp_id);
  }

  return true;
}

// ============================================================
// HTTP HELPERS
// ============================================================
String httpGet(const char* url) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(15000);
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type",  "application/json");

  int code = http.GET();
  String response = "";
  if (code == 200) {
    response = http.getString();
  } else {
    Serial.printf("[HTTP] GET %d\n", code);
  }
  http.end();
  return response;
}

bool httpPatch(const char* url, const char* body) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(15000);
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=minimal");

  int code = http.PATCH(body);
  http.end();
  if (code >= 200 && code < 300) return true;
  Serial.printf("[HTTP] PATCH %d\n", code);
  return false;
}

bool httpPost(const char* url, const char* body) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(15000);
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=minimal");

  int code = http.POST(body);
  http.end();
  if (code >= 200 && code < 300) return true;
  Serial.printf("[HTTP] POST %d\n", code);
  return false;
}

// ============================================================
// CONFIGURAÇÃO VIA NVS + CAPTIVE PORTAL (NOVO no v2)
// ============================================================

// Callback chamado pelo WiFiManager quando o usuário salva o portal.
// g_gwNumParam deve estar populado antes de chamar setupWiFi().
void onSaveParamsCallback() {
  if (!g_gwNumParam) return;
  int num = String(g_gwNumParam->getValue()).toInt();
  if (num < 1 || num > 9) num = 1;

  Preferences prefs;
  prefs.begin("ovelhinha", false);
  int previous = prefs.getInt("gw_num", 0);
  prefs.putInt("gw_num", num);
  // Se o número mudou, apaga o UUID para forçar re-registro no Supabase
  if (previous != num) prefs.remove("gw_id");
  prefs.end();

  gwNum = num;
  snprintf(gatewayName, sizeof(gatewayName), "Gateway-%02d", gwNum);
  Serial.printf("[CONFIG] Gateway #%d configurado\n", gwNum);
}

// Lê gw_num e gw_id da NVS e popula as variáveis globais.
// Deve ser chamada APÓS setupWiFi() (que pode gravar gw_num via callback).
void loadConfigFromNVS() {
  Preferences prefs;
  prefs.begin("ovelhinha", true); // read-only
  gwNum = prefs.getInt("gw_num", 0);
  String savedId = prefs.getString("gw_id", "");
  prefs.end();

  if (gwNum > 0) {
    snprintf(gatewayName, sizeof(gatewayName), "Gateway-%02d", gwNum);
  }
  if (savedId.length() == 36) {
    strlcpy(gatewayId, savedId.c_str(), 37);
  }
}

// Verifica se o botão BOOT (GPIO 9) está pressionado no boot.
// Se mantido por ≥ 3 s → apaga NVS e credenciais Wi-Fi → reinicia.
// Deve ser chamada no início de setup(), antes de qualquer acesso à NVS.
void checkResetButton() {
  pinMode(RESET_BTN_PIN, INPUT_PULLUP);
  if (digitalRead(RESET_BTN_PIN) == HIGH) return; // botão solto — boot normal

  Serial.println("[RESET] Botão BOOT pressionado — aguardando 3 s para reset...");
  // Pisca branco durante a contagem regressiva
  unsigned long pressStart = millis();
  bool ledState = false;
  while (digitalRead(RESET_BTN_PIN) == LOW) {
    unsigned long elapsed = millis() - pressStart;
    if (elapsed >= 3000) {
      // Confirmado: apaga configurações
      setColor(1, 1, 1); // branco sólido
      Serial.println("[RESET] Apagando configurações da NVS...");
      Preferences prefs;
      prefs.begin("ovelhinha", false);
      prefs.clear();
      prefs.end();
      // Apaga credenciais Wi-Fi salvas pelo WiFiManager
      WiFiManager wm;
      wm.resetSettings();
      Serial.println("[RESET] Configurações apagadas — reiniciando em 1 s...");
      delay(1000);
      esp_restart();
    }
    // Pisca branco enquanto aguarda
    if (millis() % 200 < 100) {
      if (!ledState) { setColor(1, 1, 1); ledState = true; }
    } else {
      if (ledState)  { setColor(0, 0, 0); ledState = false; }
    }
    delay(20);
  }
  // Botão solto antes de 3 s — continua boot normal
  setColor(0, 0, 0);
  Serial.println("[RESET] Botão solto antes de 3 s — boot normal");
}

// Conecta ao Wi-Fi.
//
// Fluxo:
//   - Se já houver configuração salva na NVS (portal já foi feito uma vez):
//     conecta diretamente usando as credenciais gravadas, SEM abrir o portal.
//     Se o Wi-Fi estiver indisponível (ex: roteador desligado), aguarda 30 s e
//     reinicia para tentar de novo — indefinidamente, até o Wi-Fi voltar.
//     O portal NUNCA reabre automaticamente neste caso.
//
//   - Se não houver configuração (primeiro boot ou após reset pelo botão):
//     sobe AP "Ovelhinha-GW" (senha: ovelhinha) e exibe o portal captive.
//     O portal fica aberto até o usuário configurar.
//
// Para forçar o portal novamente: segurar GPIO 9 por 3 s ao ligar.
void setupWiFi() {
  // Verifica se já passamos pelo portal antes
  Preferences prefs;
  prefs.begin("ovelhinha", true);
  int savedNum = prefs.getInt("gw_num", 0);
  prefs.end();

  if (savedNum > 0) {
    // Já configurado — conecta direto, sem portal.
    // WiFi.begin() sem args usa as credenciais gravadas na NVS pelo WiFiManager.
    Serial.println("[WIFI] Configuração encontrada — conectando sem portal...");
    WiFi.mode(WIFI_STA);
    WiFi.begin();

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
      if (millis() - start > WIFI_TIMEOUT_MS) {
        // Wi-Fi indisponível (roteador desligado, fora de alcance, etc.).
        // Reinicia e tenta novamente — o gateway voltará sozinho quando o Wi-Fi retornar.
        Serial.println("[WIFI] Wi-Fi indisponível — aguardando 30 s e reiniciando...");
        setLedMode(LED_RED_BLINK);
        delay(30000);
        esp_restart();
      }
      delay(200);
    }

    Serial.printf("[WIFI] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
    // Desativa sleep do WiFi — essencial para coexistência BLE+WiFi no ESP32-C3
    WiFi.setSleep(false);
    return;
  }

  // Sem configuração — abre portal captive pela primeira vez (ou após reset manual)
  WiFiManagerParameter customGwNum(
    "gwnum",                   // id interno
    "Numero do Gateway (1-9)", // label no portal
    "1",                       // valor padrão
    2                          // tamanho máximo
  );
  g_gwNumParam = &customGwNum;

  WiFiManager wm;
  wm.addParameter(&customGwNum);
  wm.setSaveParamsCallback(onSaveParamsCallback);

  // Callback visual: LED azul piscando enquanto portal estiver aberto
  wm.setAPCallback([](WiFiManager* myWM) {
    Serial.println("[WIFI] Portal aberto — conecte em 'Ovelhinha-GW' (senha: ovelhinha)");
    setLedMode(LED_BLUE_BLINK);
  });

  // Portal sem timeout — fica aberto até o usuário configurar
  wm.setConfigPortalTimeout(0);

  // Abre AP com senha para evitar acesso não autorizado
  bool connected = wm.autoConnect("Ovelhinha-GW", "ovelhinha");

  if (!connected) {
    Serial.println("[WIFI] Falha inesperada — reiniciando...");
    esp_restart();
  }

  Serial.printf("[WIFI] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
  // Desativa sleep do WiFi — essencial para coexistência BLE+WiFi no ESP32-C3
  WiFi.setSleep(false);

  g_gwNumParam = nullptr; // limpa ponteiro global (parâmetro local de stack será destruído)
}

// Garante que este gateway está registrado no Supabase e popula gatewayId[].
// Substitui o GATEWAY_ID hardcoded do v1: descobre ou cria a entrada em gateways
// e persiste o UUID na NVS para reutilização nos próximos boots.
void ensureGatewayRegistered() {
  // 1. Se já temos o UUID na NVS, apenas atualiza last_seen
  if (strlen(gatewayId) == 36) {
    Serial.printf("[HTTP] Gateway ID da NVS: %s — atualizando last_seen\n", gatewayId);
    String url  = String(SUPABASE_URL) + "/rest/v1/gateways?id=eq." + String(gatewayId);
    String body = "{\"last_seen\":\"" + getISOTime() + "\"}";
    httpPatch(url.c_str(), body.c_str());
    return;
  }

  // 2. Busca no Supabase pelo nome do gateway
  Serial.printf("[HTTP] Registrando gateway '%s' no Supabase...\n", gatewayName);
  String checkUrl = String(SUPABASE_URL)
    + "/rest/v1/gateways?church_id=eq." + CHURCH_ID
    + "&name=eq." + String(gatewayName)
    + "&select=id&limit=1";
  String existing = httpGet(checkUrl.c_str());

  if (!existing.isEmpty() && existing != "[]") {
    // Encontrado — extrai UUID
    JsonDocument doc;
    if (!deserializeJson(doc, existing) && doc.as<JsonArray>().size() > 0) {
      const char* id = doc[0]["id"];
      if (id && strlen(id) == 36) {
        strlcpy(gatewayId, id, 37);
        Preferences prefs;
        prefs.begin("ovelhinha", false);
        prefs.putString("gw_id", gatewayId);
        prefs.end();
        Serial.printf("[HTTP] Gateway encontrado — ID: %s\n", gatewayId);
        // Atualiza last_seen
        String url  = String(SUPABASE_URL) + "/rest/v1/gateways?id=eq." + String(gatewayId);
        String body = "{\"last_seen\":\"" + getISOTime() + "\"}";
        httpPatch(url.c_str(), body.c_str());
        return;
      }
    }
  }

  // 3. Não existe — cria e salva UUID retornado
  String insertUrl  = String(SUPABASE_URL) + "/rest/v1/gateways";
  String insertBody = "{\"church_id\":\"" + String(CHURCH_ID)
    + "\",\"name\":\"" + String(gatewayName)
    + "\",\"last_seen\":\"" + getISOTime() + "\"}";

  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  http.begin(client, insertUrl.c_str());
  http.setTimeout(15000);
  http.addHeader("apikey",        SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type",  "application/json");
  http.addHeader("Prefer",        "return=representation");
  int code = http.POST(insertBody);
  if (code == 201) {
    String resp = http.getString();
    JsonDocument doc;
    if (!deserializeJson(doc, resp) && doc.as<JsonArray>().size() > 0) {
      const char* id = doc[0]["id"];
      if (id && strlen(id) == 36) {
        strlcpy(gatewayId, id, 37);
        Preferences prefs;
        prefs.begin("ovelhinha", false);
        prefs.putString("gw_id", gatewayId);
        prefs.end();
        Serial.printf("[HTTP] Gateway criado — ID: %s\n", gatewayId);
      }
    }
  } else {
    Serial.printf("[HTTP] Falha ao criar gateway: %d\n", code);
    // gatewayId permanece vazio — heartbeat/patchCommandStatus omitirão gateway_id
  }
  http.end();
}

// ============================================================
// SUPABASE — COMANDOS
// ============================================================

// Verifica no banco se o comando ainda está pending.
// Usado entre tentativas BLE para evitar retries desnecessários quando
// outro gateway já entregou o comando.
bool isCommandStillPending(const char* id) {
  String url = String(SUPABASE_URL)
    + "/rest/v1/gateway_commands?id=eq." + id
    + "&status=eq.pending&select=id&limit=1";
  String response = httpGet(url.c_str());
  // Resposta vazia ou "[]" = não está mais pending
  if (response.isEmpty() || response == "[]") return false;
  return true;
}

void pollCommands() {
  String url = String(SUPABASE_URL)
    + "/rest/v1/gateway_commands"
    + "?church_id=eq." + CHURCH_ID
    + "&status=eq.pending"
    + "&order=created_at.asc"
    + "&limit=10";

  String response = httpGet(url.c_str());
  if (response.isEmpty() || response == "[]") return;

  JsonDocument doc;
  if (deserializeJson(doc, response)) return;

  for (JsonObject cmd : doc.as<JsonArray>()) {
    const char* id          = cmd["id"];
    const char* bracelet_id = cmd["bracelet_id"];
    const char* command     = cmd["command"];
    const char* reason      = cmd["reason"] | "";

    if (!id || !bracelet_id || !command) continue;
    if (containsId(id)) continue; // já na fila ou sendo processado

    // Multi-gateway: NÃO marcar 'sent' aqui.
    // O status só muda após tentativa BLE (tickBLE → patchCommandStatus).
    // Claim atômico garante que apenas o primeiro gateway a entregar grava o resultado.

    QueueItem item;
    strlcpy(item.id,          id,          37);
    strlcpy(item.bracelet_id, bracelet_id, 37);
    strlcpy(item.command,     command,     10);
    strlcpy(item.reason,      reason,      20);
    item.esp_id[0] = '\0';
    item.attempts  = 0;

    // Resolve MAC aqui para não bloquear durante execução BLE
    if (!resolveEspId(bracelet_id, item.esp_id)) {
      Serial.printf("[QUEUE] bracelet_id %s sem esp_id — descartando\n", bracelet_id);
      patchCommandStatus(id, "failed");
      continue;
    }

    enqueue(item);
  }
}

void patchCommandStatus(const char* id, const char* status) {
  // Claim atômico: adiciona &status=eq.pending para que apenas o primeiro gateway
  // a finalizar (sucesso ou falha) grave o resultado. Se outro gateway já gravou,
  // o PATCH afeta 0 linhas — silencioso e seguro.
  String url = String(SUPABASE_URL)
    + "/rest/v1/gateway_commands?id=eq." + id + "&status=eq.pending";

  // gatewayId pode estar vazio se o registro falhou — omite o campo nesse caso
  String body = String("{\"status\":\"") + status
    + "\",\"attempts\":"  + String(activeItem.attempts);

  if (strlen(gatewayId) == 36) {
    body += ",\"gateway_id\":\"" + String(gatewayId) + "\"";
  }

  if (strcmp(status, "sent") == 0) {
    body += ",\"delivered_at\":\"" + getISOTime() + "\"";
  }
  body += "}";

  httpPatch(url.c_str(), body.c_str());
}

void heartbeat() {
  String url  = String(SUPABASE_URL)
    + "/rest/v1/gateways?church_id=eq." + CHURCH_ID + "&name=eq." + String(gatewayName);
  String body = "{\"last_seen\":\"" + getISOTime() + "\"}";
  if (!httpPatch(url.c_str(), body.c_str())) {
    Serial.println("[HB] Falha no heartbeat");
  } else {
    Serial.println("[HB] OK");
  }
}

// ============================================================
// FILA BLE — PROCESSAMENTO
// ============================================================
void processQueue() {
  if (isEmpty() || bleOccupied) return;

  QueueItem item;
  if (!dequeue(item)) return;

  startBLEExec(item);
}

void startBLEExec(QueueItem& item) {
  activeItem   = item;
  bleOccupied  = true;
  bleExecState = BLE_EXEC_CONNECTING;

  setLedMode(LED_BLUE_BLINK);
  Serial.printf("[BLE] Executando: %s | cmd: %s | motivo: %s\n",
    item.esp_id, item.command, item.reason);
}

// Executado no loop() — avança a máquina de estados BLE sem bloquear
void tickBLE() {
  if (bleExecState == BLE_EXEC_IDLE) return;

  // ---------- SCANNING ----------
  if (bleExecState == BLE_EXEC_SCANNING) {
    if (deviceFound) {
      NimBLEDevice::getScan()->stop();
      bleExecState = BLE_EXEC_CONNECTING;
      return;
    }
    // Timeout de scan — ignora scanEnded precoce (NimBLE 2.x dispara callback imediatamente em alguns casos)
    unsigned long elapsed = millis() - bleScanStart;
    if ((scanEnded && elapsed > 2000) || elapsed > (unsigned long)(BLE_SCAN_TIMEOUT + 1000)) {
      bleExecState = BLE_EXEC_FAILED;
    }
    return;
  }

  // ---------- CONNECTING ----------
  // Bloqueio breve aceitável (~300–500 ms) para conectar + enviar
  if (bleExecState == BLE_EXEC_CONNECTING) {
    bool ok = doConnectAndSend();
    bleExecState = ok ? BLE_EXEC_DONE : BLE_EXEC_FAILED;
    return;
  }

  // ---------- DONE ----------
  if (bleExecState == BLE_EXEC_DONE) {
    Serial.printf("[BLE] OK — bracelet_id: %s — byte: 0x%02X\n",
      activeItem.bracelet_id,
      reasonToByte(activeItem.command, activeItem.reason));
    // Claim atômico: grava sent + gateway_id + delivered_at (só afeta se ainda pending)
    patchCommandStatus(activeItem.id, "sent");
    setLedMode(LED_WHITE_PULSE, 3);
    delay(2000); // ESP32-C3: aguarda WiFi se recuperar após BLE (rádio compartilhado)
    bleGraceUntil = millis() + 5000; // 5s extras para WiFi estabilizar antes de mostrar vermelho
    bleOccupied  = false;
    bleExecState = BLE_EXEC_IDLE;
    return;
  }

  // ---------- FAILED ----------
  if (bleExecState == BLE_EXEC_FAILED) {
    activeItem.attempts++;

    // Antes de retentar, verifica se outro gateway já entregou o comando.
    // Evita que todos os gateways fiquem ocupados retentando o mesmo comando.
    if (!isCommandStillPending(activeItem.id)) {
      Serial.printf("[BLE] Comando %s já entregue por outro gateway — cancelando retries\n",
        activeItem.id);
      bleOccupied  = false;
      bleExecState = BLE_EXEC_IDLE;
      return;
    }

    if (activeItem.attempts < BLE_MAX_ATTEMPTS) {
      Serial.printf("[BLE] Tentativa %d falhou — recolocando na fila\n",
        activeItem.attempts);
      requeue(activeItem);
    } else {
      Serial.printf("[BLE] Falhou após %d tentativas — bracelet_id: %s\n",
        BLE_MAX_ATTEMPTS, activeItem.bracelet_id);
      patchCommandStatus(activeItem.id, "failed");
      setLedMode(LED_RED_PULSE, 2);
    }
    bleOccupied  = false;
    bleExecState = BLE_EXEC_IDLE;
  }
}

// Conecta na pulseira e envia byte BLE — bloqueante ~300–500 ms
bool doConnectAndSend() {
  // Scan bloqueante para descobrir endereço + tipo correto do dispositivo
  deviceFound = false;
  scanEnded   = false;
  strlcpy(scanCallbacks.targetMAC, activeItem.esp_id, 18);

  NimBLEScan* pScan = NimBLEDevice::getScan();
  pScan->setScanCallbacks(&scanCallbacks, false);
  pScan->setActiveScan(true); // active: envia SCAN_REQ — necessário para detectar no ESP32-C3
  pScan->setInterval(100);
  pScan->setWindow(99);

  // Scan indefinido (duration=0): só para quando chamarmos stop() ou deviceFound=true
  // Reinicia se onScanEnd disparar prematuramente (bug NimBLE 2.x no ESP32-C3)
  unsigned long deadline = millis() + (unsigned long)BLE_SCAN_TIMEOUT;
  pScan->clearResults();
  scanEnded = false;
  pScan->start(0, false);

  while (!deviceFound && millis() < deadline) {
    if (scanEnded) {
      // onScanEnd disparou antes do tempo — reinicia o scan
      scanEnded = false;
      pScan->clearResults();
      pScan->start(0, false);
      Serial.println("[BLE] Scan reiniciado (onScanEnd precoce)");
    }
    delay(50);
  }
  pScan->stop();

  if (!deviceFound) {
    Serial.printf("[BLE] Não encontrado no scan: %s\n", activeItem.esp_id);
    pScan->clearResults();
    return false;
  }

  Serial.printf("[BLE] Encontrado: %s — conectando...\n", activeItem.esp_id);
  pScan->clearResults();
  delay(500); // Aguarda BLE stack sair completamente do modo scan antes de conectar

  NimBLEClient* pClient = NimBLEDevice::createClient();
  pClient->setConnectionParams(12, 12, 0, 51);
  pClient->setConnectTimeout(10000); // NimBLE 2.x usa ms (não segundos) — 10000ms = 10s

  if (!pClient->connect(foundAddress)) {
    Serial.println("[BLE] Falha na conexão");
    NimBLEDevice::deleteClient(pClient);
    return false;
  }

  NimBLERemoteService* pService = pClient->getService(SERVICE_UUID);
  if (!pService) {
    Serial.println("[BLE] Serviço BLE não encontrado");
    pClient->disconnect();
    NimBLEDevice::deleteClient(pClient);
    return false;
  }

  NimBLERemoteCharacteristic* pChar = pService->getCharacteristic(CHAR_UUID);
  if (!pChar) {
    Serial.println("[BLE] Characteristic não encontrada");
    pClient->disconnect();
    NimBLEDevice::deleteClient(pClient);
    return false;
  }

  uint8_t byteVal = reasonToByte(activeItem.command, activeItem.reason);
  bool written = pChar->writeValue(&byteVal, 1, true); // true = write with response

  pClient->disconnect();
  NimBLEDevice::deleteClient(pClient);
  NimBLEDevice::getScan()->clearResults();

  if (!written) {
    Serial.println("[BLE] Falha ao escrever characteristic");
    return false;
  }
  return true;
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[BOOT] Ovelhinha Gateway v2 iniciando...");

  // Inicializa pinos LED e apaga
  pinMode(PIN_R, OUTPUT);
  pinMode(PIN_G, OUTPUT);
  pinMode(PIN_B, OUTPUT);
  setColor(0, 0, 0);

  // Verifica botão BOOT (GPIO 9) — segure 3 s para resetar configurações
  // checkResetButton configura INPUT_PULLUP internamente
  checkResetButton();

  // LED vermelho = aguardando Wi-Fi / configuração
  setLedMode(LED_RED_SOLID);

  // Conecta ao Wi-Fi (e abre portal se necessário).
  // Também salva gw_num na NVS via callback se o portal foi exibido.
  setupWiFi();

  // Lê gw_num e gw_id da NVS e popula gatewayName[] e gatewayId[]
  loadConfigFromNVS();

  if (gwNum == 0) {
    // Não deveria acontecer após setupWiFi, mas por segurança
    Serial.println("[BOOT] ERRO: gw_num não configurado — verifique o portal");
    esp_restart();
  }
  Serial.printf("[BOOT] Gateway: %s\n", gatewayName);

  // Sincroniza NTP para timestamps corretos
  syncNTP();

  // Inicializa NimBLE como Central (sem nome — gateway não precisa anunciar)
  NimBLEDevice::init("");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  Serial.println("[BOOT] NimBLE inicializado");

  // Carrega mapa bracelet_id → esp_id (com retry se falhar)
  for (int i = 0; i < 3 && braceletCount == 0; i++) {
    if (i > 0) { Serial.println("[HTTP] Retry mapa pulseiras..."); delay(3000); }
    loadBracelets();
  }

  // Garante registro no Supabase e popula gatewayId[]
  ensureGatewayRegistered();

  // Pronto
  setLedMode(LED_GREEN_BLINK);
  Serial.printf("[BOOT] Gateway pronto! ID: %s\n", gatewayId);
}

// ============================================================
// LOOP PRINCIPAL (não-bloqueante — zero delay())
// ============================================================
void loop() {
  unsigned long now = millis();

  // Atualiza LED piscante
  updateLed();

  // Avança máquina de estados BLE
  tickBLE();

  // Watchdog Wi-Fi — checa a cada 10s
  if (now - lastWifiCheck >= WIFI_CHECK_MS) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      if (!wifiWasLost) {
        wifiLostAt  = now;
        wifiWasLost = true;
        Serial.println("[WIFI] Conexão perdida — reconectando...");
      }
      // Não sobrescreve o LED durante BLE nem no período de graça pós-BLE —
      // queda de WiFi durante/após BLE é esperada (rádio compartilhado no ESP32-C3)
      if (!bleOccupied && millis() > bleGraceUntil) setLedMode(LED_RED_BLINK);
      WiFi.reconnect();
      // Reinicia após 60s sem conexão
      if (now - wifiLostAt > WIFI_RESTART_MS) {
        Serial.println("[WIFI] Sem conexão por 60s — reiniciando...");
        esp_restart();
      }
    } else if (wifiWasLost) {
      wifiWasLost = false;
      wifiLostAt  = 0;
      Serial.println("[WIFI] Reconectado!");
      if (!bleOccupied) setLedMode(LED_GREEN_BLINK);
    }
  }

  // Poll de comandos Supabase
  if (WiFi.status() == WL_CONNECTED && now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    pollCommands();
  }

  // Heartbeat
  if (WiFi.status() == WL_CONNECTED && now - lastHeartbeat >= HEARTBEAT_MS) {
    lastHeartbeat = now;
    heartbeat();
  }

  // Processa próximo item da fila (só se BLE livre)
  if (!bleOccupied) {
    processQueue();
  }
}
