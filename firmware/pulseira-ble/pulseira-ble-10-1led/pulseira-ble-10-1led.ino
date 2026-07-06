/*
 * Ovelhinha — Firmware da Pulseira BLE com LED branco monocromático
 * Hardware: ESP32-C3 Super Mini + LED branco 5mm com resistor 220Ω ao GND
 *
 * Pinout LED:
 *   GPIO 4 → LED branco → resistor 220Ω → GND
 *   HIGH = acende | LOW = apaga
 *   (lógica inversa ao modelo RGB ânodo comum — aqui o cátodo vai ao GND via resistor)
 *
 * BLE:
 *   Nome:           Ovelhinha-11  (alterar BLE_NAME abaixo)
 *   Service UUID:   12345678-1234-1234-1234-123456789012
 *   Char UUID:      87654321-4321-4321-4321-210987654321
 *
 * Protocolo de comandos BLE — 1 byte (mesmo protocolo do gateway_v2/reasonToByte):
 *   0x00 = encerrar → LED apaga
 *   0x01 = Urgência   → LED pisca a 500ms
 *   0x02 = Banheiro   → LED pisca a 500ms
 *   0x03 = Chorando / Passando mal / Amamentação → LED pisca a 500ms
 *   0x04 = Outro      → LED pisca a 500ms
 *   (cor/motivo são ignorados — LED branco pisca igual para qualquer acionamento)
 *
 * Arduino IDE:
 *   Board: ESP32C3 Dev Module
 *   USB CDC On Boot: Enabled
 *   Partition Scheme: Huge APP (3MB No OTA / 1MB SPIFFS)
 *
 * Dependência: NimBLE-Arduino by h2zero
 */

#include <NimBLEDevice.h>

// ─── Configuração — ajuste aqui para cada unidade ───────────────────────────
#define BLE_NAME         "Ovelhinha-11"
#define PIN_LED          4
#define SERVICE_UUID     "12345678-1234-1234-1234-123456789012"
#define CHAR_UUID        "87654321-4321-4321-4321-210987654321"
#define BLINK_INTERVAL   500   // ms — intervalo de piscar
// ────────────────────────────────────────────────────────────────────────────

NimBLECharacteristic* pCharacteristic = nullptr;

// ─── Estado do piscar ────────────────────────────────────────────────────────
bool blinking   = false;
bool blinkState = false;
unsigned long lastBlink = 0;

// ─── Helpers de LED ──────────────────────────────────────────────────────────
void ledOn()  { digitalWrite(PIN_LED, HIGH); }
void ledOff() { digitalWrite(PIN_LED, LOW);  }

// ─── Callback: escrita na characteristic BLE ────────────────────────────────
class CommandCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChar, NimBLEConnInfo& connInfo) override {
    std::string value = pChar->getValue();
    if (value.length() == 0) return;

    uint8_t cmd = (uint8_t)value[0];

    // Protocolo gateway_v2 (reasonToByte):
    //   0x00 = encerrar
    //   0x01 = Urgência   → acionar
    //   0x02 = Banheiro   → acionar
    //   0x03 = Chorando / Passando mal / Amamentação → acionar
    //   0x04 = Outro      → acionar
    if (cmd == 0x00) {
      // Encerrar — apagar LED e parar piscar
      blinking = false;
      ledOff();
      Serial.println("Encerrado.");

    } else if (cmd >= 0x01 && cmd <= 0x04) {
      // Acionar — qualquer motivo/cor → pisca branco (cor ignorada)
      blinking   = true;
      blinkState = false;
      lastBlink  = 0;   // força primeira piscada imediata no próximo loop
      ledOff();
      Serial.print("Acionado! (motivo=0x0");
      Serial.print(cmd, HEX);
      Serial.println(")");

    } else {
      // Byte desconhecido — ignorar sem alterar estado
      Serial.print("Comando desconhecido: 0x");
      if (cmd < 0x10) Serial.print("0");  // zero padding
      Serial.print(cmd, HEX);
      Serial.println(" — ignorado");
    }
  }
};

// ─── Callback: conexão/desconexão do servidor BLE ───────────────────────────
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
    Serial.println("Cliente conectado!");
  }
  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    // Obrigatório: reiniciar advertising para aceitar nova conexão do gateway
    Serial.println("Desconectado — reiniciando advertising...");
    NimBLEDevice::getAdvertising()->start();
  }
};

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("=== " BLE_NAME " iniciando ===");

  // Configurar pino do LED
  pinMode(PIN_LED, OUTPUT);
  ledOff();

  // Sequência de boot — 3 piscadas para confirmar hardware
  Serial.println("Teste do LED...");
  for (int i = 0; i < 3; i++) {
    ledOn();  delay(200);
    ledOff(); delay(200);
  }
  Serial.println("LED OK");

  // ── Inicializar NimBLE ────────────────────────────────────────────────────
  Serial.println("Iniciando NimBLE...");
  NimBLEDevice::init(BLE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);   // potência máxima para melhor alcance

  // Imprimir MAC BLE — copiar este valor (lowercase) para o campo esp_id no app
  String mac = NimBLEDevice::getAddress().toString().c_str();
  mac.toLowerCase();
  Serial.print(">>> MAC BLE: ");
  Serial.println(mac);
  Serial.println("    Use esse valor no campo esp_id em Configuracoes > ESP32");

  // Criar servidor e registrar callbacks de conexão
  NimBLEServer* pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // Criar serviço e characteristic de escrita
  NimBLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(CHAR_UUID, NIMBLE_PROPERTY::WRITE);
  pCharacteristic->setCallbacks(new CommandCallbacks());

  pService->start();
  Serial.println("Servico BLE iniciado");

  // Configurar e iniciar advertising
  NimBLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  NimBLEDevice::getAdvertising()->setName(BLE_NAME);  // obrigatório nos boards V1601
  NimBLEDevice::getAdvertising()->start();

  Serial.println("Advertising iniciado");
  Serial.println("BLE ativo: " BLE_NAME);
  Serial.println("==============================");
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  // Lógica de piscar via millis() — nunca usa delay() para não travar o BLE
  if (blinking) {
    unsigned long now = millis();
    if (now - lastBlink >= BLINK_INTERVAL) {
      lastBlink  = now;
      blinkState = !blinkState;
      blinkState ? ledOn() : ledOff();
    }
  }

  delay(10);  // yield mínimo para o stack BLE respirar
}
