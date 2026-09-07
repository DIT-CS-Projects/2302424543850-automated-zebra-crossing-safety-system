import os
import json
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Optional: CORS – comment out if you don't need it
try:
    from flask_cors import CORS
    cors_available = True
except ImportError:
    cors_available = False

# Load .env from parent directory (project root)
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

app = Flask(__name__)

# Enable CORS only if flask-cors is installed and we're in dev
if cors_available and os.getenv('ENABLE_CORS', 'true').lower() == 'true':
    CORS(app)
    print("[CORS] Enabled (flask-cors)")

# ============================================================
# CONFIGURATION (from .env or defaults)
# ============================================================
CONFIG_FILE = 'config.json'
API_TOKEN = os.getenv('VITE_API_TOKEN', '123456789')
FLASK_PORT = int(os.getenv('FLASK_PORT', 5000))
TIMEOUT = float(os.getenv('REQUEST_TIMEOUT', 3.0))
MOCK_ESP32 = os.getenv('MOCK_ESP32', 'false').lower() == 'true'

# Load persisted config (learned IP, etc.)
config = {
    'device_ip': None,
    'device_port': 80,
    'last_heartbeat': None,
}

if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, 'r') as f:
            saved = json.load(f)
            config.update(saved)
        print("[CONFIG] Loaded successfully")
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[CONFIG] Error reading {CONFIG_FILE}: {e}")
        print("[CONFIG] Using default configuration.")
        # Backup the broken file
        if os.path.exists(CONFIG_FILE):
            os.rename(CONFIG_FILE, CONFIG_FILE + '.broken')
            print(f"[CONFIG] Renamed broken config to {CONFIG_FILE}.broken")

def save_config():
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

# ============================================================
# PROXY HELPER (forwards to ESP32)
# ============================================================
def device_request(method, path, data=None):
    if MOCK_ESP32:
        # Return mock data if MOCK_ESP32 is true
        if path == '/api/status':
            return {
                'success': True,
                'mode': 'AUTO',
                'phase': 'GREEN',
                'bumper': 'DOWN',
                'vehicleMetalConfirmed': False,
                'metalDetectedNow': False,
                'distance': 45.2,
                'speedKmh': 0.0,
                'pedestrianLight': 'RED',
                'message': 'Mock data (ESP32 not connected)'
            }, 200
        return {'success': True, 'message': 'Mock command accepted'}, 200

    if not config['device_ip']:
        return {'success': False, 'message': 'No ESP32 IP learned yet'}, 503

    url = f"http://{config['device_ip']}:{config['device_port']}{path}"
    headers = {'X-API-Key': API_TOKEN}

    try:
        if method.upper() == 'GET':
            resp = requests.get(url, headers=headers, timeout=TIMEOUT)
        else:
            resp = requests.post(url, headers=headers, data=data, timeout=TIMEOUT)

        if resp.status_code == 401:
            return {'success': False, 'message': 'ESP32 rejected API token'}, 401
        if resp.status_code == 200:
            return resp.json(), 200
        return {'success': False, 'message': f'ESP32 error {resp.status_code}'}, resp.status_code

    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'ESP32 timeout'}, 504
    except requests.exceptions.ConnectionError:
        return {'success': False, 'message': 'ESP32 unreachable'}, 503
    except Exception as e:
        return {'success': False, 'message': str(e)}, 500

# ============================================================
# ROUTES
# ============================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'device_ip': config['device_ip'],
        'last_heartbeat': config['last_heartbeat']
    })

@app.route('/api/device/heartbeat', methods=['POST'])
def receive_heartbeat():
    payload = request.form.to_dict(flat=True)
    print(f"[HEARTBEAT] {payload}")

    if payload.get('apiToken') != API_TOKEN:
        return jsonify({'success': False, 'message': 'Invalid token'}), 401

    remote_ip = request.remote_addr
    config['device_ip'] = remote_ip
    config['device_port'] = int(payload.get('devicePort', 80))
    config['last_heartbeat'] = payload.get('timestamp', 'now')
    save_config()
    print(f"[HEARTBEAT] Learned ESP32 IP: {remote_ip}:{config['device_port']}")

    return jsonify({
        'success': True,
        'message': 'Heartbeat received.',
        'deviceIpLearned': remote_ip,
        'devicePortLearned': config['device_port']
    })

@app.route('/api/status', methods=['GET'])
def proxy_status():
    result, code = device_request('GET', '/api/status')
    return jsonify(result), code

@app.route('/api/control', methods=['POST'])
def proxy_control():
    command = request.form.get('command', '').strip()
    if not command:
        return jsonify({'success': False, 'message': 'Missing command'}), 400
    result, code = device_request('POST', '/api/control', data={'command': command})
    return jsonify(result), code

@app.route('/api/device/forget', methods=['POST'])
def forget_device():
    config['device_ip'] = None
    config['last_heartbeat'] = None
    save_config()
    return jsonify({'success': True, 'message': 'ESP32 IP forgotten'})

# ============================================================
# RUN SERVER (for direct execution – Waitress will ignore this)
# ============================================================
if __name__ == '__main__':
    print("=" * 60)
    print("🚦 Gutawire Flask Proxy Server")
    print(f"   API Token: {API_TOKEN}")
    print(f"   Mock mode: {MOCK_ESP32}")
    print(f"   Listening on 0.0.0.0:{FLASK_PORT} (development)")
    print("=" * 60)
    app.run(host='0.0.0.0', port=FLASK_PORT, debug=True)