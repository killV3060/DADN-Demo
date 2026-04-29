# device.py — MicroPython code for Yolobit v2 (MQTT over WiFi)
# Upload this file to the Yolobit board via Thonny IDE.
#
# Requires: umqtt.simple (install via Thonny or upip)
#
# Wiring / hardware:
#   - Servo  → P1
#   - Fan    → P2 (PWM)
#   - LED    → P0
#   - DHT11  → P8  (temperature + humidity)
#   - LDR    → P3  (luminosity analog)

import time
import json
import network
from machine import Pin, PWM, ADC
import dht
from umqtt.simple import MQTTClient

# ── WiFi credentials ─────────────────────────────────────────────
WIFI_SSID = "Vinh"
WIFI_PASS = ""

# ── MQTT broker ──────────────────────────────────────────────────
MQTT_BROKER = "34.1.136.26"
MQTT_PORT = 1883
DEVICE_ID = "1"

TOPIC_SENSOR  = f"yolobit/sensor/{DEVICE_ID}"
TOPIC_COMMAND = f"yolobit/command/{DEVICE_ID}"

CLIENT_ID = f"yolobit-{DEVICE_ID}"

# ── Hardware setup ────────────────────────────────────────────────
sensor = dht.DHT11(Pin(8))
ldr = ADC(Pin(3))
led = Pin(0, Pin.OUT)

fan_pwm = PWM(Pin(2), freq=1000)
fan_pwm.duty(0)

servo_pwm = PWM(Pin(1), freq=50)

def servo_angle(angle):
    # Map 0-180° to duty cycle (approx 40–115 for most SG90)
    duty = int(40 + (angle / 180) * 75)
    servo_pwm.duty(duty)

servo_angle(180)  # default closed

# ── WiFi connection ───────────────────────────────────────────────
def connect_wifi():
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if not sta.isconnected():
        print("Connecting to WiFi:", WIFI_SSID)
        sta.connect(WIFI_SSID, WIFI_PASS)
        while not sta.isconnected():
            time.sleep(0.5)
    print("WiFi connected:", sta.ifconfig()[0])

# ── Command handler ───────────────────────────────────────────────
def handle_command(topic, msg):
    try:
        payload = json.loads(msg)
        cmd = payload.get("command", "")
    except Exception:
        cmd = msg.decode("utf-8").strip()

    print("Command received:", cmd)

    if cmd == "1":
        servo_angle(0)          # Servo open
    elif cmd == "2":
        servo_angle(180)        # Servo closed
    elif cmd == "3":
        led.value(1)            # LED on
    elif cmd == "4":
        led.value(0)            # LED off
    elif cmd.startswith("FAN:"):
        pct = int(cmd.split(":")[1])
        fan_pwm.duty(int(pct / 100 * 1023))
    elif cmd.startswith("TEMP:"):
        # Threshold update handled server-side; ACK only
        pass
    elif cmd.startswith("HUMID:"):
        pass

# ── Read sensors ──────────────────────────────────────────────────
def read_sensors():
    try:
        sensor.measure()
        temp = sensor.temperature()
        humid = sensor.humidity()
    except Exception:
        temp = None
        humid = None

    lumi_raw = ldr.read()
    lumi_pct = round((1023 - lumi_raw) / 1023 * 100, 1)

    return temp, humid, lumi_pct

# ── Main loop ─────────────────────────────────────────────────────
def main():
    connect_wifi()

    client = MQTTClient(CLIENT_ID, MQTT_BROKER, port=MQTT_PORT)
    client.set_callback(handle_command)
    client.connect()
    client.subscribe(TOPIC_COMMAND)
    print("Connected to MQTT broker, subscribed to", TOPIC_COMMAND)

    last_publish = 0
    PUBLISH_INTERVAL = 10  # seconds

    while True:
        client.check_msg()

        now = time.time()
        if now - last_publish >= PUBLISH_INTERVAL:
            temp, humid, lumi = read_sensors()
            payload = json.dumps({
                "deviceId": DEVICE_ID,
                "source": "mqtt-device",
                "temperature": temp,
                "humidity": humid,
                "luminosity": lumi,
                "timestamp": now,
            })
            client.publish(TOPIC_SENSOR, payload)
            print("Published:", payload)
            last_publish = now

        time.sleep(0.2)

main()
