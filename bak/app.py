from flask import Flask, render_template, request, redirect, url_for, jsonify
from datetime import datetime
import os
import json
import uuid

app = Flask(__name__)

# Function to load room data
def load_room_data(room_id):
    data_path = f'data/{room_id}.json'
    if os.path.exists(data_path):
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

# Function to save room data
def save_room_data(room_id, data):
    os.makedirs('data', exist_ok=True)
    with open(f'data/{room_id}.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    # Default room ID is today's date
    default_room_id = datetime.now().strftime('%y%m%d')
    return render_template('index.html', default_room_id=default_room_id)

@app.route('/check_room', methods=['POST'])
def check_room():
    room_id = request.form.get('room_id')
    room_data = load_room_data(room_id)
    
    if room_data:
        # Return the list of users in the room
        return jsonify({
            'exists': True,
            'users': [user['name'] for user in room_data['users']]
        })
    else:
        return jsonify({'exists': False})

@app.route('/create_room', methods=['POST'])
def create_room():
    room_id = request.form.get('room_id')
    username = request.form.get('username')
    initial_score = request.form.get('initial_score', '0')
    
    try:
        initial_score = int(initial_score)
    except ValueError:
        initial_score = 0
    
    # Create new room with the first user
    room_data = {
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'initial_score': initial_score,
        'users': [
            {
                'id': str(uuid.uuid4()),
                'name': username,
                'score': initial_score
            }
        ]
    }
    
    save_room_data(room_id, room_data)
    
    # Redirect to room page
    return redirect(url_for('room', room_id=room_id, user_id=room_data['users'][0]['id']))

@app.route('/join_room', methods=['POST'])
def join_room():
    room_id = request.form.get('room_id')
    username = request.form.get('username')
    
    room_data = load_room_data(room_id)
    
    # Check if username already exists
    for user in room_data['users']:
        if user['name'] == username:
            # User exists, return their ID
            return redirect(url_for('room', room_id=room_id, user_id=user['id']))
    
    # Add new user to the room with the initial score
    initial_score = room_data.get('initial_score', 0)
    new_user = {
        'id': str(uuid.uuid4()),
        'name': username,
        'score': initial_score
    }
    room_data['users'].append(new_user)
    save_room_data(room_id, room_data)
    
    return redirect(url_for('room', room_id=room_id, user_id=new_user['id']))

@app.route('/room/<room_id>')
def room(room_id):
    user_id = request.args.get('user_id')
    room_data = load_room_data(room_id)
    
    if not room_data:
        return redirect(url_for('index'))
    
    current_user = None
    for user in room_data['users']:
        if user['id'] == user_id:
            current_user = user
            break
    
    if not current_user:
        return redirect(url_for('index'))
    
    return render_template('room.html', 
                          room_id=room_id,
                          users=room_data['users'],
                          current_user=current_user)

@app.route('/transfer', methods=['POST'])
def transfer():
    room_id = request.form.get('room_id')
    from_user_id = request.form.get('from_user_id')
    to_user_id = request.form.get('to_user_id')
    amount = int(request.form.get('amount'))
    
    room_data = load_room_data(room_id)
    
    if not room_data:
        return jsonify({'success': False, 'message': 'Room not found'})
    
    from_user = None
    to_user = None
    
    for user in room_data['users']:
        if user['id'] == from_user_id:
            from_user = user
        if user['id'] == to_user_id:
            to_user = user
    
    if not from_user or not to_user:
        return jsonify({'success': False, 'message': 'User not found'})
    
    # Removed the check for sufficient score to allow negative balances
    
    # Perform the transfer
    from_user['score'] -= amount
    to_user['score'] += amount
    
    # Save the updated data
    save_room_data(room_id, room_data)
    
    return jsonify({
        'success': True,
        'users': room_data['users']
    })

# Add endpoint to fetch updated room data
@app.route('/get_room_data/<room_id>', methods=['GET'])
def get_room_data(room_id):
    room_data = load_room_data(room_id)
    
    if not room_data:
        return jsonify({'success': False, 'message': 'Room not found'})
    
    # Add additional field for the client to check if users have changed
    return jsonify({
        'success': True,
        'users': room_data['users'],
        'user_count': len(room_data['users']),
        'timestamp': datetime.now().timestamp()
    })

if __name__ == '__main__':
    app.run(debug=True)
