/*
 * ============================================================
 * Ovelhinha — Gateway ESP32-C3
 * Faz poll no Supabase por comandos pendentes e os executa
 * via BLE nas pulseiras dos pais.
 * ============================================================
 *
 * DEPENDÊNCIAS (instalar via Library Manager):
 *   - NimBLE-Arduino by h2zero
 *   - ArduinoJson by Benoit Blanchon (v7.x)
 *   WiFi.h, HTTPClient.h, Ticker.h são built-in do ESP32.
 *
 * PLACA: ESP32-C3 Super Mini
 * Board Manager URL: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 * Board: ESP32C3 Dev Module
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
#include <time.h>

// ============================================================
// CONFIGURAÇÕES — edite antes de gravar
// ============================================================
#define WIFI_SSID         "D&D"
#define WIFI_PASSWORD     "27804028"
#define SUPABASE_URL      "https://reefzadzwbmhkojtjqhz.supabase.co"
#define SUPABASE_KEY      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZWZ6YWR6d2JtaGtvanRqcWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzUzNDksImV4cCI6MjA5MDgxMTM0OX0.RoAIEJoJT31EdmkjA_3LeyDdiw9f9uK0GuJd2OvfQ_E"
#define CHURCH_ID         "00000000-0000-0000-0000-000000000001"
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
bool          wifiWasLost   = false;

// Estado BLE
BLEExecState  bleExecState  = BLE_EXEC_IDLE;
QueueItem     activeItem;
bool          bleOccupied   = false;
bool          deviceFound   = false;
bool          scanEnded     = false;
unsigned long bleScanStart  = 0;
NimBLEAddress           foundAddress;
NimBLEAdvertisedDevice* foundDevice = nullptr;

// Estado LED
LedMode       currentLedMode = LED_OFF;
unsigned long ledLastToggle  = 0;
bool          ledBlinkState  = false;
int           pulseCount     = 0;
int           pulseTarget    = 0;

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
      foundAddress  = device->getAddress();  // copia o endereço antes do scan limpar
      foundDevice   = const_cast<NimBLEAdvertisedDevice*>(device);
      deviceFound   = true;
      NimBLEDevice::getScan()->stop();
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
void     registerGateway();
void     pollCommands();
void     heartbeat();
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
    case LED_BLUE_BLINK:  interval = 300; break;
    case LED_RED_BLINK:   interval = 500; break;
    default:              interval = 120; break; // pulsos rápidos
  }

  if (now - ledLastToggle < interval) return;
  ledLastToggle = now;
  ledBlinkState = !ledBlinkState;

  switch (currentLedMode) {
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
          setLedMode(LED_GREEN);
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
          setLedMode(LED_GREEN);
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
  for (int i = 0; i < braceletCount; i++) {
    if (strcmp(bracelets[i].id, bracelet_id) == 0) {
      strlcpy(out_esp_id, bracelets[i].esp_id, 18);
      return true;
    }
  }
  return false;
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
// SUPABASE — GATEWAY
// ============================================================
void registerGateway() {
  Serial.println("[HTTP] Registrando gateway...");
  String now     = getISOTime();
  String patchUrl = String(SUPABASE_URL)
    + "/rest/v1/gateways?church_id=eq." + CHURCH_ID + "&name=eq.Gateway-01";
  String body = "{\"last_seen\":\"" + now + "\"}";

  // Tenta atualizar — se não existir, insere
  bool updated = httpPatch(patchUrl.c_str(), body.c_str());
  if (!updated) {
    String insertUrl  = String(SUPABASE_URL) + "/rest/v1/gateways";
    String insertBody = "{\"church_id\":\"" + String(CHURCH_ID)
      + "\",\"name\":\"Gateway-01\",\"last_seen\":\"" + now + "\"}";
    httpPost(insertUrl.c_str(), insertBody.c_str());
  }
  Serial.println("[HTTP] Gateway registrado");
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

    // Marca como 'sent' ANTES de enfileirar — evita duplo envio se resetar
    patchCommandStatus(id, "sent");

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
  String url  = String(SUPABASE_URL) + "/rest/v1/gateway_commands?id=eq." + id;
  String body = String("{\"status\":\"") + status + "\",\"attempts\":"
    + String(activeItem.attempts) + "}";
  httpPatch(url.c_str(), body.c_str());
}

void heartbeat() {
  String url  = String(SUPABASE_URL) + "/rest/v1/gateways?church_id=eq." + CHURCH_ID;
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
    setLedMode(LED_WHITE_PULSE, 3);
    delay(2000); // ESP32-C3: aguarda WiFi se recuperar após BLE (rádio compartilhado)
    bleOccupied  = false;
    bleExecState = BLE_EXEC_IDLE;
    return;
  }

  // ---------- FAILED ----------
  if (bleExecState == BLE_EXEC_FAILED) {
    activeItem.attempts++;
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
  pScan->clearResults();
  pScan->setScanCallbacks(&scanCallbacks, false);
  pScan->setActiveScan(true);
  pScan->setInterval(100);
  pScan->setWindow(99);
  pScan->start(BLE_SCAN_TIMEOUT / 1000, false); // NimBLE 2.x: retorna bool, não bloqueante

  // Aguarda scan terminar ou dispositivo ser encontrado
  unsigned long deadline = millis() + (unsigned long)BLE_SCAN_TIMEOUT + 1000;
  while (!scanEnded && !deviceFound && millis() < deadline) {
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

  NimBLEClient* pClient = NimBLEDevice::createClient();
  pClient->setConnectTimeout(10);

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
  Serial.println("[BOOT] Ovelhinha Gateway iniciando...");

  // Inicializa pinos LED e apaga
  pinMode(PIN_R, OUTPUT);
  pinMode(PIN_G, OUTPUT);
  pinMode(PIN_B, OUTPUT);
  setColor(0, 0, 0);

  // LED vermelho = aguardando Wi-Fi
  setLedMode(LED_RED_SOLID);

  // Conecta Wi-Fi — tenta por até 30s, reinicia se falhar
  Serial.printf("[WIFI] Conectando a %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - wifiStart > WIFI_TIMEOUT_MS) {
      Serial.println("[WIFI] Timeout de 30s — reiniciando...");
      esp_restart();
    }
    delay(200);
  }
  Serial.printf("[WIFI] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());

  // Sincroniza NTP para timestamps corretos
  syncNTP();

  // Inicializa NimBLE como Central (sem nome — gateway não precisa anunciar)
  NimBLEDevice::init("");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  Serial.println("[BOOT] NimBLE inicializado");

  // Carrega mapa bracelet_id → esp_id
  loadBracelets();

  // Registra/atualiza gateway no Supabase
  registerGateway();

  // Pronto
  setLedMode(LED_GREEN);
  Serial.println("[BOOT] Gateway pronto!");
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
      setLedMode(LED_RED_BLINK);
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
      if (!bleOccupied) setLedMode(LED_GREEN);
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
