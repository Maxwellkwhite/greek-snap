from flask import Flask, render_template, jsonify, request, session
from flask_bootstrap import Bootstrap
import os
import random
import json
from datetime import datetime
from game import Game, CHARACTERS

app = Flask(__name__)

# Initialize Bootstrap
bootstrap = Bootstrap(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

# Global game instance
current_game = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/game')
def game():
    global current_game
    if current_game is None:
        current_game = Game()
    return render_template('game.html', game=current_game, characters=CHARACTERS)

@app.route('/api/game-state')
def get_game_state():
    global current_game
    if current_game is None:
        current_game = Game()
    
    return jsonify(current_game.get_game_state())

@app.route('/api/play-card', methods=['POST'])
def play_card():
    global current_game
    data = request.get_json()
    
    # Check if game exists, create new one if it doesn't
    if current_game is None:
        current_game = Game()
        return jsonify({
            "success": False,
            "message": "Game was reset. Please try again.",
            "game_state": current_game.get_game_state()
        })
    
    card_index = data.get('card_index')
    location_index = data.get('location_index')
    
    success, message = current_game.play_card(card_index, location_index, "player")
    
    return jsonify({
        "success": success,
        "message": message,
        "game_state": current_game.get_game_state()
    })

@app.route('/api/end-turn', methods=['POST'])
def end_turn():
    global current_game
    
    # Check if game exists, create new one if it doesn't
    if current_game is None:
        current_game = Game()
        return jsonify({
            "success": True,
            "game_state": current_game.get_game_state()
        })
    
    # Simple AI opponent move
    if current_game.opponent_hand and current_game.opponent_energy > 0:
        # Find playable cards
        playable_cards = []
        for i, card in enumerate(current_game.opponent_hand):
            if card["cost"] <= current_game.opponent_energy:
                playable_cards.append(i)
        
        if playable_cards:
            # Play a random playable card to a random location
            card_index = random.choice(playable_cards)
            location_index = random.randint(0, 2)
            current_game.play_card(card_index, location_index, "opponent")
    
    current_game.end_turn()
    
    return jsonify({
        "success": True,
        "game_state": current_game.get_game_state()
    })

@app.route('/api/new-game', methods=['POST'])
def new_game():
    global current_game
    current_game = Game()
    
    return jsonify({
        "success": True,
        "game_state": current_game.get_game_state()
    })

if __name__ == "__main__":
    app.run(debug=True, port=5002)




