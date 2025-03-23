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

    # 创建房间时，第一个用户为房主，初始化last_change为0
    first_user = {
        'id': str(uuid.uuid4()),
        'name': username,
        'score': initial_score,
        'last_change': 0,
        'owner': True
    }
    room_data = {
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'initial_score': initial_score,
        'users': [first_user],
        'baseline': { first_user['id']: initial_score },
        'settlement_reports': [],
        'settlement_count': 0
    }

    save_room_data(room_id, room_data)

    return redirect(url_for('room', room_id=room_id, user_id=first_user['id']))

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

    # Add new user to the room with the initial score and last_change
    initial_score = room_data.get('initial_score', 0)
    new_user = {
        'id': str(uuid.uuid4()),
        'name': username,
        'score': initial_score,
        'last_change': 0,
        'owner': False
    }
    room_data['users'].append(new_user)
    room_data['baseline'][new_user['id']] = initial_score
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

    # Sort settlement reports by count in descending order
    room_data['settlement_reports'].sort(key=lambda x: x['count'], reverse=True)

    return render_template('room.html',
                          room_id=room_id,
                          users=room_data['users'],
                          current_user=current_user,
                          room_data=room_data)

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
@app.route('/next_round', methods=['POST'])
def next_round():
    room_id = request.form.get('room_id')
    room_data = load_room_data(room_id)

    if not room_data:
        return jsonify({'success': False, 'message': 'Room not found'})

    # Calculate last_change for each user based on difference from baseline
    for user in room_data['users']:
        baseline = room_data['baseline'].get(user['id'], user['score'])
        user['last_change'] = user['score'] - baseline
        # Update baseline for next round
        room_data['baseline'][user['id']] = user['score']

    save_room_data(room_id, room_data)

    return jsonify({
        'success': True,
        'users': room_data['users']
    })

@app.route('/settle', methods=['POST'])
def settle():
    room_id = request.form.get('room_id')
    room_data = load_room_data(room_id)

    if not room_data:
        return jsonify({'success': False, 'message': 'Room not found'})

    # Calculate winners and losers
    winners = []
    losers = []
    for user in room_data['users']:
        if user['score'] > room_data['initial_score']:
            winners.append({
                'id': user['id'],
                'name': user['name'],
                'amount': user['score'] - room_data['initial_score']
            })
        elif user['score'] < room_data['initial_score']:
            losers.append({
                'id': user['id'],
                'name': user['name'],
                'amount': room_data['initial_score'] - user['score']
            })

    # Sort by amount to handle largest differences first
    winners.sort(key=lambda x: x['amount'], reverse=True)
    losers.sort(key=lambda x: x['amount'], reverse=True)

    # Generate settlement report
    report_lines = []
    settlements = []  # Track actual settlements needed

    # Add summary section
    total_amount = sum(winner['amount'] for winner in winners)
    report_lines.append("【结算汇总】<br>")
    report_lines.append(f"• 总结算金额：{total_amount} 积分<br>")
    report_lines.append(f"• 盈利玩家：{len(winners)} 人<br>")
    report_lines.append(f"• 亏损玩家：{len(losers)} 人<br>")
    report_lines.append("<br>")

    # Add winners section
    if winners:
        report_lines.append("【盈利玩家】<br>")
        for winner in winners:
            report_lines.append(f"• {winner['name']}：+{winner['amount']} 积分<br>")
        report_lines.append("<br>")

    # Add losers section
    if losers:
        report_lines.append("【亏损玩家】<br>")
        for loser in losers:
            report_lines.append(f"• {loser['name']}：-{loser['amount']} 积分<br>")
        report_lines.append("<br>")

    # Process settlements
    report_lines.append("【转账明细】<br>")
    # Process each loser
    for loser in losers:
        remaining_amount = loser['amount']
        loser_settlements = []

        # Try to settle with winners who still need to receive
        for winner in winners:
            if remaining_amount <= 0 or winner['amount'] <= 0:
                continue

            # Calculate settlement amount
            settlement_amount = min(remaining_amount, winner['amount'])
            if settlement_amount > 0:
                loser_settlements.append({
                    'from': loser['name'],
                    'to': winner['name'],
                    'amount': settlement_amount
                })
                remaining_amount -= settlement_amount
                winner['amount'] -= settlement_amount

        settlements.extend(loser_settlements)

        # Add to report
        if loser_settlements:
            report_lines.append(f"• {loser['name']} 需要支付：<br>")
            for settlement in loser_settlements:
                report_lines.append(f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- {settlement['amount']} 积分给 {settlement['to']}<br>")

    # Create the settlement report
    room_data['settlement_count'] += 1
    report = "\n".join(report_lines)
    room_data['settlement_reports'].append({
        'count': room_data['settlement_count'],
        'report': report,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })

    # Reset scores and last_change
    for user in room_data['users']:
        user['score'] = room_data['initial_score']
        user['last_change'] = 0
        room_data['baseline'][user['id']] = room_data['initial_score']

    save_room_data(room_id, room_data)

    return jsonify({
        'success': True,
        'users': room_data['users'],
        'settlement_count': room_data['settlement_count'],
        'report': report
    })

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
        'timestamp': datetime.now().timestamp(),
        'settlement_reports': room_data['settlement_reports']
    })

if __name__ == '__main__':
    app.run(debug=True)
