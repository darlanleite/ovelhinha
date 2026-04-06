/*
 * Ovelhinha — Firmware da Pulseira BLE com LED RGB externo
 * Hardware: ESP32-C3 Super Mini + LED RGB ânodo comum
 *
 * Pinout LED (lado esquerdo da placa):
 *   GND → pino G (2º pino esq.) — sem resistor
 *   R   → GPIO 2 (6º pino esq.) — vermelho
 *   G   → GPIO 3 (5º pino esq.) — verde
 *   B   → GPIO 4 (4º pino esq.) — azul
 *
 * BLE:
 *   Nome:           Ovelhinha-07
 *   Service UUID:   12345678-1234-1234-1234-123456789012
 *   Char UUID:      87654321-4321-4321-4321-210987654321
 *
 * Protocolo — 1 byte:
 *   0x00 = apagar (pai chegou)
 *   0x01 = vermelho  → Urgência
 *   0x02 = amarelo   → Banheiro
 *   0x03 = azul      → Chorando / Passando mal / Amamentação
 *   0x04 = branco    → Outro
 *
 * Dependência: NimBLE-Arduino by h2zero
 */

#include <NimBLEDevice.h>

#define PIN_R  2
#define PIN_G  3
#define PIN_B  4

#define BLE_NAME     "Ovelhinha-07"
#define SERVICE_UUID "12345678-1234-1234-1234-123456789012"
#define CHAR_UUID    "87654321-4321-4321-4321-210987654321"

NimBLECharacteristic* pCharacteristic = nullptr;

bool blinking = false;
bool blinkState = false;
unsigned long lastBlink = 0;
int blinkR = 0, blinkG = 0, blinkB = 0;

void setupLED() {
  pinMode(PIN_R, OUTPUT);
  pinMode(PIN_G, OUTPUT);
  pinMode(PIN_B, OUTPUT);
}

void setColor(int r, int g, int b) {
  // Ânodo comum: LOW=acende, HIGH=apaga
  digitalWrite(PIN_R, r > 0 ? LOW : HIGH);
  digitalWrite(PIN_G, g > 0 ? LOW : HIGH);
  digitalWrite(PIN_B, b > 0 ? LOW : HIGH);
}

void applyCommand(uint8_t cmd) {
  blinking = false;
  switch (cmd) {
    case 0x00: setColor(0, 0, 0);       Serial.println("LED OFF");      break;
    case 0x01: // vermelho piscando rápido — Urgência
      blinkR = 255; blinkG = 0;  blinkB = 0;
      blinking = true;
      Serial.println("LED URGENCIA (vermelho piscando)");
      break;
    case 0x02: // amarelo piscando — Banheiro
      blinkR = 255; blinkG = 80; blinkB = 0;
      blinking = true;
      Serial.println("LED BANHEIRO (amarelo piscando)");
      break;
    case 0x03: // azul piscando — Chorando / Passando mal
      blinkR = 0;   blinkG = 40; blinkB = 255;
      blinking = true;
      Serial.println("LED CHORANDO (azul piscando)");
      break;
    case 0x04: // branco fixo — Outro
      setColor(180, 180, 180);
      Serial.println("LED OUTRO (branco)");
      break;
    default:
      Serial.print("Byte desconhecido: 0x");
      Serial.println(cmd, HEX);
  }
}

class CommandCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChar, NimBLEConnInfo& connInfo) override {
    std::string value = pChar->getValue();
    if (value.length() == 0) return;
    uint8_t cmd = (uint8_t)value[0];
    Serial.print("Comando recebido: 0x0");
    Serial.println(cmd, HEX);
    applyCommand(cmd);
  }
};

class ServerCallbacks : public NimBLEServerCallbacks {
  void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
    Serial.println("Desconectado — reiniciando advertising...");
    NimBLEDevice::getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);

  setupLED();
  setColor(0, 0, 0);

  // Cicla todas as cores ao ligar — confirma que LEDs e conexão funcionam
  setColor(255, 0,   0);   delay(400); // vermelho  — Urgência
  setColor(0,   0,   0);   delay(150);
  setColor(255, 80,  0);   delay(400); // amarelo   — Banheiro
  setColor(0,   0,   0);   delay(150);
  setColor(0,   40,  255); delay(400); // azul      — Chorando
  setColor(0,   0,   0);   delay(150);
  setColor(180, 180, 180); delay(400); // branco    — Outro
  setColor(0,   0,   0);   delay(150);
  setColor(0,   200, 0);   delay(400); // verde     — pronto
  setColor(0,   0,   0);   delay(200);

  NimBLEDevice::init(BLE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  NimBLEServer* pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  NimBLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(CHAR_UUID, NIMBLE_PROPERTY::WRITE);
  pCharacteristic->setCallbacks(new CommandCallbacks());

  pService->start();
  NimBLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
  NimBLEDevice::getAdvertising()->start();

  Serial.println("BLE ativo: " BLE_NAME);
}

void loop() {
  if (blinking) {
    unsigned long now = millis();
    unsigned long interval = (blinkR == 255 && blinkG == 0) ? 250 : 500; // urgência pisca mais rápido
    if (now - lastBlink >= interval) {
      lastBlink = now;
      blinkState = !blinkState;
      blinkState ? setColor(blinkR, blinkG, blinkB) : setColor(0, 0, 0);
    }
  }
  delay(10);
}
