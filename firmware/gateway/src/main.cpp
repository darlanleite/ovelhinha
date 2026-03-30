/*
 * Ovelhinha — Firmware do Gateway
 * Hardware: ESP32-C3 Super Mini (fixo na tomada, sem LED)
 *
 * Fluxo:
 *   Backend (WebSocket) → Gateway (Wi-Fi) → Pulseira (BLE)
 *
 * Configuração obrigatória antes de gravar:
 *   WIFI_SSID    → nome da rede Wi-Fi da igreja
 *   WIFI_PASS    → senha da rede
 *   WS_HOST      → IP ou domínio do backend (ex: "192.168.1.100")
 *   WS_PORT      → porta do backend (ex: 3001)
 *
 * Protocolo WebSocket (recebe do backend):
 *   {"bracelet": 7, "cmd": "on",    "color": "red"}
 *   {"bracelet": 7, "cmd": "blink", "color": "red"}
 *   {"bracelet": 7, "cmd": "off"}
 *   {"bracelet": 7, "cmd": "ping"}
 *
 * O gateway escaneia BLE e conecta na pulseira "Ovelhinha-7",
 * depois repassa o comando diretamente para ela.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>

// ─── Configuração ─────────────────────────────────────────────────────────────
#define WIFI_SSID   "NOME_DA_REDE"
#define WIFI_PASS   "SENHA_DA_REDE"
#define WS_HOST     "192.168.1.100"   // ← IP do backend na rede local
#define WS_PORT     3001
#define WS_PATH     "/gateway"

// ─── UUIDs (mesmos da pulseira) ───────────────────────────────────────────────
#define SERVICE_UUID  "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ─── Estado ───────────────────────────────────────────────────────────────────
WebSocketsClient ws;
NimBLEScan* pScan = nullptr;

struct PendingCommand {
    bool pending = false;
    uint8_t braceletNumber = 0;
    String payload;
};

PendingCommand pendingCmd;

// ─── BLE: envia comando para uma pulseira pelo número ─────────────────────────
bool sendToBracelet(uint8_t number, const String& payload) {
    String targetName = "Ovelhinha-" + String(number);
    Serial.println("Buscando BLE: " + targetName);

    NimBLEScanResults results = pScan->start(4, false); // scan 4 segundos

    for (int i = 0; i < results.getCount(); i++) {
        NimBLEAdvertisedDevice device = results.getDevice(i);
        if (device.getName() == targetName.c_str()) {
            Serial.println("Encontrou! Conectando...");
            NimBLEClient* pClient = NimBLEDevice::createClient();
            if (!pClient->connect(&device)) {
                Serial.println("Falha ao conectar");
                NimBLEDevice::deleteClient(pClient);
                return false;
            }

            NimBLERemoteService* pService = pClient->getService(SERVICE_UUID);
            if (!pService) {
                Serial.println("Service nao encontrado");
                pClient->disconnect();
                NimBLEDevice::deleteClient(pClient);
                return false;
            }

            NimBLERemoteCharacteristic* pChar = pService->getCharacteristic(CHAR_UUID);
            if (!pChar) {
                Serial.println("Characteristic nao encontrada");
                pClient->disconnect();
                NimBLEDevice::deleteClient(pClient);
                return false;
            }

            pChar->writeValue(payload.c_str(), payload.length());
            Serial.println("Comando enviado: " + payload);

            pClient->disconnect();
            NimBLEDevice::deleteClient(pClient);
            return true;
        }
    }

    Serial.println("Pulseira nao encontrada no alcance BLE");
    return false;
}

// ─── WebSocket callback ───────────────────────────────────────────────────────
void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_CONNECTED:
            Serial.println("WebSocket conectado ao backend");
            ws.sendTXT("{\"type\":\"gateway\",\"id\":\"gw-01\"}");
            break;

        case WStype_DISCONNECTED:
            Serial.println("WebSocket desconectado, reconectando...");
            break;

        case WStype_TEXT: {
            String msg = (char*)payload;
            Serial.println("WS recebido: " + msg);

            JsonDocument doc;
            DeserializationError err = deserializeJson(doc, msg);
            if (err) {
                Serial.println("JSON invalido");
                break;
            }

            uint8_t bracelet = doc["bracelet"] | 0;
            const char* cmd  = doc["cmd"]      | "off";
            const char* color = doc["color"]   | "";

            if (bracelet == 0) break;

            // Monta payload para repassar à pulseira
            String fwd = "{\"cmd\":\"" + String(cmd) + "\"";
            if (strlen(color) > 0) fwd += ",\"color\":\"" + String(color) + "\"";
            fwd += "}";

            pendingCmd = { true, bracelet, fwd };
            break;
        }

        default: break;
    }
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);

    // Wi-Fi
    Serial.print("Conectando Wi-Fi");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWi-Fi OK: " + WiFi.localIP().toString());

    // WebSocket
    ws.begin(WS_HOST, WS_PORT, WS_PATH);
    ws.onEvent(onWsEvent);
    ws.setReconnectInterval(3000);

    // BLE
    NimBLEDevice::init("OvelhinhaGW");
    pScan = NimBLEDevice::getScan();
    pScan->setActiveScan(true);
    pScan->setInterval(100);
    pScan->setWindow(99);

    Serial.println("Gateway pronto");
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    ws.loop();

    if (pendingCmd.pending) {
        pendingCmd.pending = false;
        bool ok = sendToBracelet(pendingCmd.braceletNumber, pendingCmd.payload);
        // Notifica o backend sobre o resultado
        String resp = "{\"type\":\"ack\",\"bracelet\":" + String(pendingCmd.braceletNumber) +
                      ",\"success\":" + (ok ? "true" : "false") + "}";
        ws.sendTXT(resp);
    }

    delay(10);
}
