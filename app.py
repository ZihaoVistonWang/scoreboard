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
    is_zero_sum = request.form.get('is_zero_sum', 'true').lower() == 'true'

    try:
        initial_score = int(initial_score)
    except ValueError:
        initial_score = 0

    # Create room with first user as owner
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
        'is_zero_sum': is_zero_sum,
        'users': [first_user],
        'baseline': { first_user['id']: initial_score },
        'settlement_reports': [],
        'settlement_count': 0,
        'can_next_round': False,
        'can_settle': False
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

@app.route('/watch_room', methods=['POST'])
def watch_room():
    room_id = request.form.get('room_id')
    room_data = load_room_data(room_id)

    if not room_data:
        return redirect(url_for('index'))

    # For spectators, we'll pass a special user_id 'spectator'
    return redirect(url_for('room', room_id=room_id, user_id='spectator'))

@app.route('/room/<room_id>')
def room(room_id):
    user_id = request.args.get('user_id')
    room_data = load_room_data(room_id)

    if not room_data:
        return redirect(url_for('index'))

    # Handle spectator mode
    if user_id == 'spectator':
        # Sort settlement reports by timestamp in descending order (most recent first)
        if 'settlement_reports' in room_data:
            room_data['settlement_reports'].sort(key=lambda x: x['timestamp'], reverse=True)
        return render_template('room.html',
                            room_id=room_id,
                            users=room_data['users'],
                            current_user={'id': 'spectator', 'name': '观看者', 'owner': False},
                            room_data=room_data,
                            is_spectator=True,
                            is_zero_sum=room_data.get('is_zero_sum', True))

    current_user = None
    for user in room_data['users']:
        if user['id'] == user_id:
            current_user = user
            break

    if not current_user:
        return redirect(url_for('index'))

    # Sort settlement reports by timestamp in descending order (most recent first)
    if 'settlement_reports' in room_data:
        room_data['settlement_reports'].sort(key=lambda x: x['timestamp'], reverse=True)

    return render_template('room.html',
                          room_id=room_id,
                          users=room_data['users'],
                          current_user=current_user,
                          room_data=room_data,
                          is_spectator=False,
                          is_zero_sum=room_data.get('is_zero_sum', True))

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

    # Check if this is a zero-sum game
    is_zero_sum = room_data.get('is_zero_sum', True)  # Default to True for backward compatibility
    
    # Check if the from_user is the owner in non-zero-sum game
    if not is_zero_sum and not from_user.get('owner', False):
        return jsonify({'success': False, 'message': '只有房主可以修改积分'})

    # For zero-sum games, deduct from sender
    if is_zero_sum:
        from_user['score'] -= amount

    # Add to receiver
    to_user['score'] += amount

    # Can next round flag
    room_data['can_next_round'] = True

    # Can settle flag
    room_data['can_settle'] = False

    # Save the updated data
    save_room_data(room_id, room_data)

    return jsonify({
        'success': True,
        'users': room_data['users'],
        'can_next_round': room_data['can_next_round'],
        'can_settle': room_data['can_settle']
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
        user['last_score'] = user['score']
        user['last_change'] = user['score'] - baseline
        # Update baseline for next round
        room_data['baseline'][user['id']] = user['score']

    # Set can_next_round and can_settle flags
    room_data['can_next_round'] = False
    room_data['can_settle'] = True

    save_room_data(room_id, room_data)

    return jsonify({
        'success': True,
        'users': room_data['users'],
        'can_next_round': room_data['can_next_round'],
        'can_settle': room_data['can_settle']
    })

@app.route('/settle', methods=['POST'])
def settle():
    room_id = request.form.get('room_id')
    room_data = load_room_data(room_id)

    if not room_data:
        return jsonify({'success': False, 'message': 'Room not found'})

    # Increment settlement count
    room_data['settlement_count'] = room_data.get('settlement_count', 0) + 1

    # Generate settlement report based on game type
    report_lines = []
    is_zero_sum = room_data.get('is_zero_sum', True)  # Default to True for backward compatibility

    if is_zero_sum:
        # Zero-sum game settlement logic
        winners = []
        losers = []
        neutral_users = []
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
            else:
                neutral_users.append({
                    'id': user['id'],
                    'name': user['name'],
                    'amount': 0
                })

        # Sort by amount to handle largest differences first
        winners.sort(key=lambda x: x['amount'], reverse=True)
        losers.sort(key=lambda x: x['amount'], reverse=True)

        # Add summary section
        total_amount = sum(winner['amount'] for winner in winners)
        report_lines.append("【结算汇总】<br>")
        report_lines.append(f"• 总结算金额：{total_amount} 积分<br>")
        report_lines.append(f"• 盈利玩家：{len(winners)} 人<br>")
        report_lines.append(f"• 亏损玩家：{len(losers)} 人<br>")
        report_lines.append(f"• 陪玩玩家：{len(neutral_users)} 人<br>")
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

        # Add neutral users section
        if neutral_users:
            report_lines.append("【陪玩玩家】<br>")
            for neutral_user in neutral_users:
                report_lines.append(f"• {neutral_user['name']}：0 积分<br>")
            report_lines.append("<br>")

        # Process settlements
        report_lines.append("【转账明细】<br>")
        # Process each loser
        for loser in losers:
            remaining_amount = loser['amount']
            if remaining_amount <= 0:  # Skip if the user has no remaining amount
                continue

            report_lines.append(f"• {loser['name']} 需要：<br>")

            # Distribute remaining amount among winners
            for winner in winners:
                if remaining_amount <= 0:
                    break

                if winner['amount'] <= 0:
                    continue

                # Determine the amount to transfer
                transfer_amount = min(remaining_amount, winner['amount'])
                winner['amount'] -= transfer_amount
                remaining_amount -= transfer_amount
                report_lines.append(f"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- 给 {winner['name']} 转账 {transfer_amount} 积分<br>")

    else:
        # Non-zero-sum game settlement logic
        # Sort users by score
        sorted_users = sorted(room_data['users'], key=lambda x: x['score'], reverse=True)

        report_lines.append("【积分排名】<br>")
        for i, user in enumerate(sorted_users, 1):
            report_lines.append(f"• 第{i}名：{user['name']} - {user['score']} 积分<br>")
        report_lines.append("<br>")

        # Add statistics
        total_score = sum(user['score'] for user in room_data['users'])
        avg_score = total_score / len(room_data['users'])
        report_lines.append("【统计信息】<br>")
        report_lines.append(f"• 总积分：{total_score}<br>")
        report_lines.append(f"• 平均积分：{avg_score:.1f}<br>")
        report_lines.append(f"• 最高积分：{sorted_users[0]['score']} ({sorted_users[0]['name']})<br>")
        report_lines.append(f"• 最低积分：{sorted_users[-1]['score']} ({sorted_users[-1]['name']})<br>")

    # Reset user's score to initial value, clear last_change, and update baseline
    for user in room_data['users']:
        user['score'] = room_data['initial_score']
        user['last_change'] = 0
        user['last_score'] = 0
        room_data['baseline'][user['id']] = room_data['initial_score']

    # Add timestamp to report
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    report_lines.append("<br>")
    report_lines.append(f"结算时间：{current_time}")

    # Create settlement report
    report = {
        'count': room_data['settlement_count'],
        'timestamp': current_time,
        'report': '\n'.join(report_lines)
    }

    # Add report to room data
    if 'settlement_reports' not in room_data:
        room_data['settlement_reports'] = []
    room_data['settlement_reports'].append(report)

    # Reset flags after settlement
    room_data['can_next_round'] = False
    room_data['can_settle'] = False

    # Save updated room data
    save_room_data(room_id, room_data)

    return jsonify({
        'success': True,
        'users': room_data['users'],
        'settlement_count': room_data['settlement_count'],
        'timestamp': current_time,
        'report': report['report'],
        'can_next_round': room_data['can_next_round'],
        'can_settle': room_data['can_settle']
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
        'settlement_reports': room_data['settlement_reports'],
        'can_next_round': room_data.get('can_next_round', False),
        'can_settle': room_data.get('can_settle', False)
    })

@app.route('/get_rooms', methods=['GET'])
def get_rooms():
    rooms = []
    data_dir = 'data'
    if os.path.exists(data_dir):
        for filename in os.listdir(data_dir):
            if filename.endswith('.json'):
                room_id = filename[:-5]  # Remove .json extension
                room_data = load_room_data(room_id)
                if room_data:
                    rooms.append({
                        'id': room_id,
                        'created_at': room_data['created_at']
                    })
    
    # Sort rooms by creation time in descending order
    rooms.sort(key=lambda x: x['created_at'], reverse=True)
    return jsonify(rooms)

if __name__ == '__main__':
    app.run(debug=True, port=16868)
