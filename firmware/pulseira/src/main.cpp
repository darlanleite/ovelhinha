/*
 * Ovelhinha — Firmware da Pulseira
 * Hardware: ESP32-C3 Super Mini + LED RGB (cátodo comum)
 *
 * Pinagem sugerida:
 *   LED R → GPIO3 (via resistor 220Ω)
 *   LED G → GPIO4 (via resistor 220Ω)
 *   LED B → GPIO5 (via resistor 220Ω)
 *   Bateria → GPIO1 (ADC, divisor de tensão 100kΩ+100kΩ)
 *
 * Configuração obrigatória antes de gravar:
 *   BRACELET_NUMBER → número físico gravado na pulseira (ex: 7)
 *
 * Protocolo BLE:
 *   Service UUID:        4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *   Characteristic UUID: beb5483e-36e1-4688-b7f5-ea07361b26a8
 *
 *   Comandos recebidos (string JSON):
 *     {"cmd":"on",  "color":"red"}     → Liga vermelho  (urgência)
 *     {"cmd":"on",  "color":"yellow"}  → Liga amarelo   (banheiro)
 *     {"cmd":"on",  "color":"blue"}    → Liga azul      (médico)
 *     {"cmd":"on",  "color":"green"}   → Liga verde     (confirmação)
 *     {"cmd":"on",  "color":"white"}   → Liga branco    (aviso geral)
 *     {"cmd":"off"}                    → Apaga LED
 *     {"cmd":"blink", "color":"red"}   → Pisca rápido   (reacionamento)
 *     {"cmd":"ping"}                   → Responde com status (battery %)
 */

#include <Arduino.h>
#include <NimBLEDevice.h>

// ─── Configuração ────────────────────────────────────────────────────────────
#define BRACELET_NUMBER   1      // ← MUDE PARA O NÚMERO DESTA PULSEIRA

#define PIN_LED_R         3
#define PIN_LED_G         4
#define PIN_LED_B         5
#define PIN_BATTERY       1      // ADC — divisor de tensão

// ─── UUIDs ───────────────────────────────────────────────────────────────────
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID           "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ─── Estado ──────────────────────────────────────────────────────────────────
struct Color { uint8_t r, g, b; };

const Color COLOR_OFF    = {0,   0,   0  };
const Color COLOR_RED    = {255, 0,   0  };
const Color COLOR_YELLOW = {255, 180, 0  };
const Color COLOR_BLUE   = {0,   0,   255};
const Color COLOR_GREEN  = {0,   255, 80 };
const Color COLOR_WHITE  = {255, 255, 255};

bool blinking = false;
bool blinkState = false;
Color currentColor = COLOR_OFF;
unsigned long lastBlink = 0;
const unsigned long BLINK_INTERVAL = 300; // ms

NimBLECharacteristic* pCharacteristic = nullptr;

// ─── LED ─────────────────────────────────────────────────────────────────────
void setLED(Color c) {
    analogWrite(PIN_LED_R, c.r);
    analogWrite(PIN_LED_G, c.g);
    analogWrite(PIN_LED_B, c.b);
}

// ─── Bateria ─────────────────────────────────────────────────────────────────
uint8_t readBatteryPercent() {
    // Divisor de tensão 1:2 → tensão máxima 4.2V → ADC ~2.1V
    // ESP32-C3 ADC: 0-3.3V → 0-4095
    int raw = analogRead(PIN_BATTERY);
    float voltage = (raw / 4095.0f) * 3.3f * 2.0f;
    float percent = (voltage - 3.0f) / (4.2f - 3.0f) * 100.0f;
    return (uint8_t)constrain((int)percent, 0, 100);
}

// ─── Parser de comando ────────────────────────────────────────────────────────
Color colorFromString(const String& s) {
    if (s == "red")    return COLOR_RED;
    if (s == "yellow") return COLOR_YELLOW;
    if (s == "blue")   return COLOR_BLUE;
    if (s == "green")  return COLOR_GREEN;
    if (s == "white")  return COLOR_WHITE;
    return COLOR_WHITE;
}

void handleCommand(const String& payload) {
    Serial.println("CMD: " + payload);

    // Parsing manual simples (sem lib JSON para economizar RAM)
    if (payload.indexOf("\"cmd\":\"off\"") >= 0) {
        blinking = false;
        currentColor = COLOR_OFF;
        setLED(COLOR_OFF);
        return;
    }

    if (payload.indexOf("\"cmd\":\"ping\"") >= 0) {
        uint8_t bat = readBatteryPercent();
        String resp = "{\"battery\":" + String(bat) + ",\"bracelet\":" + String(BRACELET_NUMBER) + "}";
        pCharacteristic->setValue(resp.c_str());
        pCharacteristic->notify();
        return;
    }

    // Extrai color
    Color c = COLOR_WHITE;
    int ci = payload.indexOf("\"color\":\"");
    if (ci >= 0) {
        int start = ci + 9;
        int end = payload.indexOf("\"", start);
        String colorStr = payload.substring(start, end);
        c = colorFromString(colorStr);
    }

    if (payload.indexOf("\"cmd\":\"blink\"") >= 0) {
        blinking = true;
        currentColor = c;
        return;
    }

    if (payload.indexOf("\"cmd\":\"on\"") >= 0) {
        blinking = false;
        currentColor = c;
        setLED(c);
        return;
    }
}

// ─── BLE Callbacks ───────────────────────────────────────────────────────────
class CommandCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pChar) override {
        String value = pChar->getValue().c_str();
        handleCommand(value);
    }
};

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    pinMode(PIN_LED_R, OUTPUT);
    pinMode(PIN_LED_G, OUTPUT);
    pinMode(PIN_LED_B, OUTPUT);
    setLED(COLOR_OFF);

    // Pisca verde 2x para indicar que ligou
    for (int i = 0; i < 2; i++) {
        setLED(COLOR_GREEN);
        delay(200);
        setLED(COLOR_OFF);
        delay(200);
    }

    String deviceName = "Ovelhinha-" + String(BRACELET_NUMBER, DEC);
    NimBLEDevice::init(deviceName.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);

    NimBLEServer* pServer = NimBLEDevice::createServer();
    NimBLEService* pService = pServer->createService(SERVICE_UUID);

    pCharacteristic = pService->createCharacteristic(
        CHAR_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::NOTIFY
    );
    pCharacteristic->setCallbacks(new CommandCallbacks());
    pCharacteristic->setValue("ready");

    pService->start();

    NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->start();

    Serial.println("BLE ativo: " + deviceName);
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    if (blinking) {
        unsigned long now = millis();
        if (now - lastBlink >= BLINK_INTERVAL) {
            lastBlink = now;
            blinkState = !blinkState;
            setLED(blinkState ? currentColor : COLOR_OFF);
        }
    }
    delay(10);
}
