import time
import threading
from collections import defaultdict
from flask_socketio import emit, join_room, leave_room
from game import Game

# Global socketio instance (will be set from main.py)
socketio = None

def set_socketio(sio):
    global socketio
    socketio = sio

class MatchmakingSystem:
    def __init__(self):
        self.queue = []  # List of players waiting to be matched
        self.active_games = {}  # game_id -> game_instance
        self.player_to_game = {}  # player_id -> game_id
        self.game_counter = 0
        self.lock = threading.Lock()
        
    def add_player_to_queue(self, player_id, player_hand_data):
        """Add a player to the matchmaking queue"""
        with self.lock:
            # Check if player is already in queue or in a game
            if player_id in [p['player_id'] for p in self.queue]:
                return False, "Already in queue"
            
            if player_id in self.player_to_game:
                return False, "Already in a game"
            
            player_data = {
                'player_id': player_id,
                'hand_data': player_hand_data,
                'timestamp': time.time()
            }
            
            self.queue.append(player_data)
            print(f"Player {player_id} added to queue. Queue size: {len(self.queue)}")
            
            # Try to match players
            self._try_match_players()
            
            return True, "Added to queue"
    
    def remove_player_from_queue(self, player_id):
        """Remove a player from the matchmaking queue"""
        with self.lock:
            self.queue = [p for p in self.queue if p['player_id'] != player_id]
            print(f"Player {player_id} removed from queue. Queue size: {len(self.queue)}")
    
    def _try_match_players(self):
        """Try to match players in the queue"""
        if len(self.queue) >= 2:
            # Take the first two players
            player1 = self.queue.pop(0)
            player2 = self.queue.pop(0)
            
            # Create a new game
            game_id = self._create_game(player1, player2)
            print(f"Created game {game_id} with players {player1['player_id']} and {player2['player_id']}")
    
    def _create_game(self, player1, player2):
        """Create a new game between two players"""
        self.game_counter += 1
        game_id = f"game_{self.game_counter}"
        
        # Create game instance with player1's hand
        game = Game(player_deck_ids=player1['hand_data'])
        
        # Store game data
        game_data = {
            'game': game,
            'player1_id': player1['player_id'],
            'player2_id': player2['player_id'],
            'player1_hand': player1['hand_data'],
            'player2_hand': player2['hand_data'],
            'created_at': time.time(),
            'status': 'active'
        }
        
        self.active_games[game_id] = game_data
        self.player_to_game[player1['player_id']] = game_id
        self.player_to_game[player2['player_id']] = game_id
        
        # Notify both players that a game has been found
        if socketio:
            print(f"Attempting to notify player {player1['player_id']} about game {game_id}")
            socketio.emit('game_found', {
                'game_id': game_id,
                'message': 'Game found! Starting match...'
            }, room=f"player_{player1['player_id']}")
            
            print(f"Attempting to notify player {player2['player_id']} about game {game_id}")
            socketio.emit('game_found', {
                'game_id': game_id,
                'message': 'Game found! Starting match...'
            }, room=f"player_{player2['player_id']}")
            
            # Also emit to all connected clients as a fallback
            print("Emitting game_found to all clients as fallback")
            socketio.emit('game_found', {
                'game_id': game_id,
                'message': 'Game found! Starting match...',
                'player1_id': player1['player_id'],
                'player2_id': player2['player_id']
            })
        
        return game_id
    
    def get_player_game(self, player_id):
        """Get the game a player is currently in"""
        game_id = self.player_to_game.get(player_id)
        if game_id and game_id in self.active_games:
            return self.active_games[game_id]
        return None
    
    def remove_player_from_game(self, player_id):
        """Remove a player from their current game"""
        game_id = self.player_to_game.get(player_id)
        if game_id and game_id in self.active_games:
            del self.active_games[game_id]
            del self.player_to_game[player_id]
            # Also remove the other player
            game_data = self.active_games.get(game_id, {})
            other_player = game_data.get('player2_id') if game_data.get('player1_id') == player_id else game_data.get('player1_id')
            if other_player:
                del self.player_to_game[other_player]
    
    def get_queue_status(self, player_id):
        """Get the current status of a player in the queue"""
        with self.lock:
            for i, player in enumerate(self.queue):
                if player['player_id'] == player_id:
                    return {
                        'in_queue': True,
                        'position': i + 1,
                        'queue_size': len(self.queue)
                    }
            return {'in_queue': False}

# Global matchmaking instance
matchmaking = MatchmakingSystem() 