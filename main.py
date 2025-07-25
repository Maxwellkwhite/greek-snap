from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_bootstrap import Bootstrap
import os
import random
import json
import pickle
import base64
from datetime import datetime
from game import Game, CHARACTERS
from flask_login import LoginManager, UserMixin, login_required, current_user, login_user, logout_user
from sqlalchemy.orm import relationship, DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String, Date, JSON, Boolean, DateTime, func
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from xp_system import XPSystem

app = Flask(__name__)

# Initialize Bootstrap
bootstrap = Bootstrap(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return db.get_or_404(User, user_id)

class Base(DeclarativeBase):
    pass

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DB_URI", 'sqlite:///users.db')
db = SQLAlchemy(model_class=Base)
db.init_app(app)

#user DB
class User(UserMixin, db.Model):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(100), unique=True)
    password: Mapped[str] = mapped_column(String(100))
    date_of_signup: Mapped[Date] = mapped_column(Date)
    xp: Mapped[int] = mapped_column(Integer, default=0)  # XP points
    last_daily_win: Mapped[Date] = mapped_column(Date, nullable=True)  # Track daily win bonus
    misc1: Mapped[str] = mapped_column(String(100), nullable=True)
    misc2: Mapped[str] = mapped_column(String(100), nullable=True)
    misc3: Mapped[str] = mapped_column(String(100), nullable=True)
    
    # Relationship to collection
    collection = relationship("UserCollection", back_populates="user", uselist=False)

# Collection DB
class UserCollection(db.Model):
    __tablename__ = "user_collections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, db.ForeignKey("users.id"))
    unlocked_cards: Mapped[JSON] = mapped_column(JSON, default=list)  # List of card IDs
    date_created: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    date_updated: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationship to user
    user = relationship("User", back_populates="collection")

# Game State DB
class GameState(db.Model):
    __tablename__ = "game_states"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, db.ForeignKey("users.id"))
    game_data: Mapped[JSON] = mapped_column(JSON)  # Serialized game state
    date_created: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    date_updated: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

# Helper functions for game state management
def save_game_state(user_id, game):
    """Save game state to database"""
    try:
        # Serialize the game object
        game_bytes = pickle.dumps(game)
        game_data = base64.b64encode(game_bytes).decode('utf-8')
        
        # Check if game state already exists for this user
        existing_state = GameState.query.filter_by(user_id=user_id).first()
        if existing_state:
            existing_state.game_data = game_data
            existing_state.date_updated = func.now()
        else:
            new_state = GameState(user_id=user_id, game_data=game_data)
            db.session.add(new_state)
        
        db.session.commit()
        return True
    except Exception as e:
        print(f"Error saving game state: {e}")
        db.session.rollback()
        return False

def load_game_state(user_id):
    """Load game state from database"""
    try:
        game_state = GameState.query.filter_by(user_id=user_id).first()
        if game_state and game_state.game_data:
            # Deserialize the game object
            game_bytes = base64.b64decode(game_state.game_data.encode('utf-8'))
            game = pickle.loads(game_bytes)
            return game
        return None
    except Exception as e:
        print(f"Error loading game state: {e}")
        return None

def clear_game_state(user_id):
    """Clear game state from database"""
    try:
        # Use delete() with synchronize_session=False to avoid the warning
        deleted_count = GameState.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        db.session.commit()
        return True
    except Exception as e:
        print(f"Error clearing game state: {e}")
        db.session.rollback()
        return False







@app.route('/')
def index():
    if current_user.is_authenticated:
        # Get user's XP and level info
        user_level = XPSystem.get_level_from_xp(current_user.xp)
        xp_for_next = XPSystem.get_xp_for_next_level(current_user.xp)
        progress = XPSystem.get_progress_to_next_level(current_user.xp)
        
        # Check for pending rewards
        user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
        if user_collection and user_collection.unlocked_cards is not None:
            unlocked_cards = user_collection.unlocked_cards if isinstance(user_collection.unlocked_cards, list) else []
        else:
            unlocked_cards = []
        pending_rewards = XPSystem.get_pending_rewards(current_user.xp, unlocked_cards)
        
        # Get all level rewards for display
        from xp_system import LEVEL_REWARDS, LEVEL_XP_REQUIREMENTS
        
        # Create a mapping of card IDs to names for display
        card_id_to_name = {card['id']: card['name'] for card in CHARACTERS}
        
        return render_template('index.html', 
                             user=current_user, 
                             level=user_level,
                             xp=current_user.xp,
                             xp_for_next=xp_for_next,
                             progress=progress,
                             pending_rewards=pending_rewards,
                             level_rewards=LEVEL_REWARDS,
                             level_xp_requirements=LEVEL_XP_REQUIREMENTS,
                             card_id_to_name=card_id_to_name,
                             unlocked_cards=unlocked_cards)
    else:
        return render_template('index.html', 
                             user=current_user,
                             level=1,
                             xp=0,
                             xp_for_next=100,
                             progress=0,
                             pending_rewards=[],
                             level_rewards={},
                             level_xp_requirements={},
                             card_id_to_name={},
                             unlocked_cards=[])



@app.route('/single-player')
@login_required
def single_player_game():
    # Check if user has a current hand selected
    current_hand_data = current_user.misc2
    if not current_hand_data:
        # No hand selected, redirect to index with message
        flash('Please select a battle hand before starting a single player game.', 'warning')
        return redirect(url_for('index'))
    
    try:
        current_hand = json.loads(current_hand_data)
        if not current_hand or 'cards' not in current_hand:
            flash('Please select a valid battle hand before starting a single player game.', 'warning')
            return redirect(url_for('index'))
    except (json.JSONDecodeError, TypeError):
        flash('Please select a valid battle hand before starting a single player game.', 'warning')
        return redirect(url_for('index'))
    
    return render_template('single_player_game.html', user=current_user)

@app.route('/collection')
@login_required
def collection():
    # Get or create user collection
    user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
    if not user_collection:
        user_collection = UserCollection(user_id=current_user.id, unlocked_cards=[])
        db.session.add(user_collection)
        db.session.commit()
    else:
        # Ensure the unlocked_cards field is properly initialized as a list
        if user_collection.unlocked_cards is None:
            user_collection.unlocked_cards = []
            db.session.commit()
    # Get all cards and mark which ones are unlocked
    all_cards = CHARACTERS.copy()
    unlocked_cards = user_collection.unlocked_cards if isinstance(user_collection.unlocked_cards, list) else []
    unlocked_card_ids = set(unlocked_cards)
    
    for card in all_cards:
        card['unlocked'] = card['id'] in unlocked_card_ids
    
    # Separate owned and all cards
    owned_cards = [card for card in all_cards if card['unlocked']]
    
    return render_template('collection.html', 
                         all_cards=all_cards, 
                         owned_cards=owned_cards, 
                         user=current_user)



@app.route('/create-hand')
@login_required
def create_hand():
    """Page where users can select 10 cards to create their hand"""
    # Get or create user collection
    user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
    if not user_collection:
        user_collection = UserCollection(user_id=current_user.id, unlocked_cards=[])
        db.session.add(user_collection)
        db.session.commit()
    else:
        # Ensure the unlocked_cards field is properly initialized as a list
        if user_collection.unlocked_cards is None:
            user_collection.unlocked_cards = []
            db.session.commit()
    
    # Get all cards and mark which ones are unlocked
    all_cards = CHARACTERS.copy()
    unlocked_cards = user_collection.unlocked_cards if isinstance(user_collection.unlocked_cards, list) else []
    unlocked_card_ids = set(unlocked_cards)
    
    for card in all_cards:
        card['unlocked'] = card['id'] in unlocked_card_ids
    
    # Separate owned and all cards
    owned_cards = [card for card in all_cards if card['unlocked']]
    
    return render_template('create_hand.html', 
                         all_cards=all_cards, 
                         owned_cards=owned_cards, 
                         user=current_user)

@app.route('/api/unlock-card', methods=['POST'])
@login_required
def unlock_card():
    data = request.get_json()
    card_id = data.get('card_id')
    
    if not card_id:
        return jsonify({"success": False, "message": "Card ID is required"})
    
    # Get or create user collection
    user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
    if not user_collection:
        user_collection = UserCollection(user_id=current_user.id, unlocked_cards=[])
        db.session.add(user_collection)
    
    # Ensure unlocked_cards is a list
    if user_collection.unlocked_cards is None:
        user_collection.unlocked_cards = []
    elif not isinstance(user_collection.unlocked_cards, list):
        user_collection.unlocked_cards = list(user_collection.unlocked_cards) if user_collection.unlocked_cards else []
    
    # Add card to collection if not already there
    if card_id not in user_collection.unlocked_cards:
        user_collection.unlocked_cards.append(card_id)
        db.session.commit()
        return jsonify({"success": True, "message": f"Card unlocked!"})
    else:
        return jsonify({"success": False, "message": "Card already unlocked"})

@app.route('/api/collection')
@login_required
def get_collection():
    """Get user's collection data via API"""
    user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
    if not user_collection:
        user_collection = UserCollection(user_id=current_user.id, unlocked_cards=[])
        db.session.add(user_collection)
        db.session.commit()
    
    unlocked_cards = user_collection.unlocked_cards if isinstance(user_collection.unlocked_cards, list) else []
    return jsonify({
        "unlocked_cards": unlocked_cards,
        "total_cards": len(CHARACTERS),
        "completion_percentage": round((len(unlocked_cards) / len(CHARACTERS)) * 100, 1)
    })

@app.route('/api/award-xp', methods=['POST'])
@login_required
def award_xp():
    """Award XP to user (no automatic card unlocking)"""
    data = request.get_json()
    xp_source = data.get('source')
    amount = data.get('amount')
    
    if not xp_source:
        return jsonify({"success": False, "message": "XP source is required"})
    
    # Get XP amount from source if not specified
    if amount is None:
        amount = XPSystem.get_xp_source_amount(xp_source)
    
    if amount <= 0:
        return jsonify({"success": False, "message": "Invalid XP amount"})
    
    # Get current level before XP award
    old_level = XPSystem.get_level_from_xp(current_user.xp)
    
    # Award XP
    current_user.xp += amount
    
    # Get new level after XP award
    new_level = XPSystem.get_level_from_xp(current_user.xp)
    
    # Save changes
    db.session.commit()
    
    # Get updated level info
    xp_for_next = XPSystem.get_xp_for_next_level(current_user.xp)
    progress = XPSystem.get_progress_to_next_level(current_user.xp)
    
    return jsonify({
        "success": True,
        "message": f"Awarded {amount} XP!",
        "new_xp": current_user.xp,
        "old_level": old_level,
        "new_level": new_level,
        "leveled_up": new_level > old_level,
        "xp_for_next": xp_for_next,
        "progress": progress
    })

@app.route('/api/claim-level-reward', methods=['POST'])
@login_required
def claim_level_reward():
    """Claim rewards for a specific level"""
    data = request.get_json()
    level = data.get('level')
    
    if not level:
        return jsonify({"success": False, "message": "Level is required"})
    
    # Verify user has reached this level
    user_level = XPSystem.get_level_from_xp(current_user.xp)
    if user_level < level:
        return jsonify({"success": False, "message": "You haven't reached this level yet"})
    
    # Get or create user collection
    user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
    if not user_collection:
        user_collection = UserCollection(user_id=current_user.id, unlocked_cards=[])
        db.session.add(user_collection)
        db.session.commit()  # Commit to ensure the collection exists
    else:
        # Ensure the unlocked_cards field is properly initialized as a list
        if user_collection.unlocked_cards is None:
            user_collection.unlocked_cards = []
            db.session.commit()
    
    # Get rewards for this level
    level_rewards = XPSystem.get_rewards_for_level(level)
    
    # Debug logging
    print(f"DEBUG: Claiming level {level} rewards")
    print(f"DEBUG: Level rewards: {level_rewards}")
    print(f"DEBUG: Current unlocked cards: {user_collection.unlocked_cards}")
    print(f"DEBUG: Unlocked cards type: {type(user_collection.unlocked_cards)}")
    print(f"DEBUG: User collection ID: {user_collection.id}")
    print(f"DEBUG: User ID: {current_user.id}")
    
    # Check which rewards haven't been claimed yet
    new_rewards = []
    
    # Ensure unlocked_cards is a list and handle potential None values
    if user_collection.unlocked_cards is None:
        current_unlocked = []
    elif isinstance(user_collection.unlocked_cards, list):
        current_unlocked = user_collection.unlocked_cards.copy()
    else:
        # Handle case where it might be stored as a string or other format
        try:
            current_unlocked = list(user_collection.unlocked_cards) if user_collection.unlocked_cards else []
        except:
            current_unlocked = []
    
    print(f"DEBUG: Processing unlocked cards: {current_unlocked} (type: {type(current_unlocked)})")
    
    for card_id in level_rewards:
        if card_id not in current_unlocked:
            current_unlocked.append(card_id)
            new_rewards.append(card_id)
            print(f"DEBUG: Adding card ID {card_id} to collection")
        else:
            print(f"DEBUG: Card ID {card_id} already unlocked")
    
    if not new_rewards:
        return jsonify({"success": False, "message": "All rewards for this level have already been claimed"})
    
    # Update the collection with the new list
    user_collection.unlocked_cards = current_unlocked
    user_collection.date_updated = func.now()
    
    # Save changes
    db.session.commit()
    
    # Refresh the object to get the updated data
    db.session.refresh(user_collection)
    
    print(f"DEBUG: Final unlocked cards: {user_collection.unlocked_cards}")
    
    return jsonify({
        "success": True,
        "message": f"Claimed rewards for level {level}!",
        "new_rewards": new_rewards
    })

@app.route('/api/game-result', methods=['POST'])
@login_required
def game_result():
    """Handle game completion and award XP"""
    data = request.get_json()
    result = data.get('result')  # 'win', 'loss', or 'tie'
    
    if not result:
        return jsonify({"success": False, "message": "Game result is required"})
    
    # Award XP based on result
    if result == 'win':
        xp_source = 'game_win'
        message = "Victory! You won the game!"
    elif result == 'loss':
        xp_source = 'game_loss'
        message = "Game over. Better luck next time!"
    else: # tie
        xp_source = 'game_loss'  # Same as loss for ties
        message = "It's a tie!"
    
    # Award XP
    xp_amount = XPSystem.get_xp_source_amount(xp_source)
    old_level = XPSystem.get_level_from_xp(current_user.xp)
    
    current_user.xp += xp_amount
    
    # Get new level after XP award
    new_level = XPSystem.get_level_from_xp(current_user.xp)
    
    # Save changes
    db.session.commit()
    
    # Get updated level info
    xp_for_next = XPSystem.get_xp_for_next_level(current_user.xp)
    progress = XPSystem.get_progress_to_next_level(current_user.xp)
    
    return jsonify({
        "success": True,
        "message": f"{message} +{xp_amount} XP!",
        "new_xp": current_user.xp,
        "old_level": old_level,
        "new_level": new_level,
        "leveled_up": new_level > old_level,
        "xp_for_next": xp_for_next,
        "progress": progress
    })

@app.route('/api/clear-game-state', methods=['POST'])
@login_required
def clear_game_state_endpoint():
    """Clear the current game state"""
    try:
        if clear_game_state(current_user.id):
            return jsonify({
                "success": True,
                "message": "Game state cleared successfully."
            })
        else:
            return jsonify({
                "success": False,
                "message": "Failed to clear game state."
            })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error clearing game state: {str(e)}"
        })

@app.route('/api/reset-user', methods=['POST'])
@login_required
def reset_user():
    """Reset all user data (XP, collection, etc.)"""
    try:
        # Reset XP to 0
        current_user.xp = 0
        current_user.last_daily_win = None
        
        # Reset hands data
        current_user.misc1 = None
        
        # Reset collection to cards 1-10
        user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
        if user_collection:
            # Reset to cards 1-10
            initial_cards = list(range(1, 11))  # Cards 1-10
            user_collection.unlocked_cards = initial_cards
            user_collection.date_updated = func.now()
            db.session.commit()
            db.session.refresh(user_collection)
            print(f"DEBUG: Reset - Reset collection for user {current_user.id} to cards 1-10")
            print(f"DEBUG: Reset - Collection now has {len(user_collection.unlocked_cards)} cards")
        else:
            # Create new collection with cards 1-10 if it doesn't exist
            initial_cards = list(range(1, 11))  # Cards 1-10
            user_collection = UserCollection(user_id=current_user.id, unlocked_cards=initial_cards)
            db.session.add(user_collection)
            db.session.commit()
            print(f"DEBUG: Reset - Created new collection with cards 1-10 for user {current_user.id}")
        
        # Verify the reset worked
        db.session.refresh(user_collection)
        final_card_count = len(user_collection.unlocked_cards) if user_collection.unlocked_cards else 0
        print(f"DEBUG: Reset - Final card count: {final_card_count}")
        
        return jsonify({
            "success": True,
            "message": "User data reset successfully! You now have cards 1-10 in your collection and all hands have been cleared.",
            "new_xp": 0,
            "new_level": 1,
            "unlocked_cards": user_collection.unlocked_cards
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Error resetting user data: {str(e)}"
        })

@app.route('/api/debug-user', methods=['GET'])
@login_required
def debug_user():
    """Debug endpoint to check user state"""
    user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
    if user_collection and user_collection.unlocked_cards is not None:
        unlocked_cards = user_collection.unlocked_cards if isinstance(user_collection.unlocked_cards, list) else []
    else:
        unlocked_cards = []
    
    # Get card names for unlocked cards
    card_names = []
    for card_id in unlocked_cards:
        card = next((c for c in CHARACTERS if c['id'] == card_id), None)
        if card:
            card_names.append(f"{card['name']} (ID: {card_id})")
        else:
            card_names.append(f"Unknown Card (ID: {card_id})")
    
    # Get pending rewards
    pending_rewards = XPSystem.get_pending_rewards(current_user.xp, unlocked_cards)
    pending_names = []
    for reward in pending_rewards:
        card = next((c for c in CHARACTERS if c['id'] == reward['card_id']), None)
        if card:
            pending_names.append(f"Level {reward['level']}: {card['name']} (ID: {reward['card_id']})")
        else:
            pending_names.append(f"Level {reward['level']}: Unknown Card (ID: {reward['card_id']})")
    
    return jsonify({
        "user_id": current_user.id,
        "email": current_user.email,
        "xp": current_user.xp,
        "level": XPSystem.get_level_from_xp(current_user.xp),
        "unlocked_cards": unlocked_cards,
        "unlocked_card_names": card_names,
        "pending_rewards": pending_rewards,
        "pending_reward_names": pending_names,
        "total_cards": len(CHARACTERS)
    })



@app.route('/api/new-game', methods=['POST'])
@login_required
def new_game():
    """Start a new single player game"""
    # Get the user's current hand
    current_hand_data = current_user.misc2
    if not current_hand_data:
        return jsonify({
            "success": False,
            "message": "No hand selected. Please select a battle hand first."
        })
    
    try:
        current_hand = json.loads(current_hand_data)
        if not current_hand or 'cards' not in current_hand:
            return jsonify({
                "success": False,
                "message": "Invalid hand data. Please select a valid battle hand."
            })
        
        # Clear any existing game state
        clear_game_state(current_user.id)
        
        # Create new game with the current hand
        from game import Game
        game = Game(player_deck_ids=current_hand["cards"])
        
        # Save the game state
        if save_game_state(current_user.id, game):
            return jsonify({
                "success": True,
                "game_state": game.get_game_state(),
                "hand_name": current_hand["name"]
            })
        else:
            return jsonify({
                "success": False,
                "message": "Failed to save game state."
            })
        
    except (json.JSONDecodeError, TypeError):
        return jsonify({
            "success": False,
            "message": "Error reading hand data. Please select a valid battle hand."
        })

@app.route('/api/play-card', methods=['POST'])
@login_required
def play_card():
    """Play a card in single player game"""
    data = request.get_json()
    
    card_index = data.get('card_index')
    location_index = data.get('location_index')
    
    if card_index is None or location_index is None:
        return jsonify({
            "success": False,
            "message": "Card index and location index are required."
        })
    
    try:
        # Load existing game state
        game = load_game_state(current_user.id)
        if not game:
            return jsonify({
                "success": False,
                "message": "No active game found. Please start a new game."
            })
        
        success, message = game.play_card(card_index, location_index, "player")
        
        if success:
            # Save the updated game state
            save_game_state(current_user.id, game)
        
        return jsonify({
            "success": success,
            "message": message,
            "game_state": game.get_game_state()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error playing card: {str(e)}"
        })

@app.route('/api/ai-play-card', methods=['POST'])
@login_required
def ai_play_card():
    """AI plays a card in single player game"""
    data = request.get_json()
    
    card_index = data.get('card_index')
    location_index = data.get('location_index')
    
    if card_index is None or location_index is None:
        return jsonify({
            "success": False,
            "message": "Card index and location index are required."
        })
    
    try:
        # Load existing game state
        game = load_game_state(current_user.id)
        if not game:
            return jsonify({
                "success": False,
                "message": "No active game found. Please start a new game."
            })
        
        success, message = game.play_card(card_index, location_index, "opponent")
        
        if success:
            # Save the updated game state
            save_game_state(current_user.id, game)
        
        return jsonify({
            "success": success,
            "message": message,
            "game_state": game.get_game_state()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error with AI playing card: {str(e)}"
        })

@app.route('/api/ai-end-turn', methods=['POST'])
@login_required
def ai_end_turn():
    """AI ends turn in single player game"""
    try:
        # Load existing game state
        game = load_game_state(current_user.id)
        if not game:
            return jsonify({
                "success": False,
                "message": "No active game found. Please start a new game."
            })
        
        # In single player mode, we can end the turn regardless of whose turn it is
        success, message = game.end_turn()
        
        if success:
            # Save the updated game state
            save_game_state(current_user.id, game)
        
        return jsonify({
            "success": success,
            "message": message,
            "game_state": game.get_game_state()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error with AI ending turn: {str(e)}"
        })

@app.route('/api/end-turn', methods=['POST'])
@login_required
def end_turn():
    """Player ends turn in single player game"""
    try:
        # Load existing game state
        game = load_game_state(current_user.id)
        if not game:
            return jsonify({
                "success": False,
                "message": "No active game found. Please start a new game."
            })
        
        success, message = game.end_turn("player")
        
        if success:
            # Save the updated game state
            save_game_state(current_user.id, game)
        
        return jsonify({
            "success": success,
            "message": message,
            "game_state": game.get_game_state()
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error ending turn: {str(e)}"
        })

@app.route('/api/save-hand', methods=['POST'])
@login_required
def save_hand():
    """Save the user's selected hand of 10 cards"""
    data = request.get_json()
    selected_cards = data.get('selected_cards', [])
    
    if len(selected_cards) != 10:
        return jsonify({
            "success": False,
            "message": "You must select exactly 10 cards for your hand."
        })
    
    # Verify all selected cards are in user's collection
    user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
    if not user_collection:
        return jsonify({
            "success": False,
            "message": "User collection not found."
        })
    
    unlocked_cards = user_collection.unlocked_cards if isinstance(user_collection.unlocked_cards, list) else []
    unlocked_card_ids = set(unlocked_cards)
    
    for card_id in selected_cards:
        if card_id not in unlocked_card_ids:
            return jsonify({
                "success": False,
                "message": f"Card ID {card_id} is not in your collection."
            })
    
    # Save the hand (we'll store it in the user's misc1 field for now)
    # Format: {"hands": [{"name": "Hand 1", "cards": [1,2,3...]}, ...]}
    try:
        existing_data = json.loads(current_user.misc1) if current_user.misc1 else None
        # Handle both old format (list) and new format (dict)
        if isinstance(existing_data, list):
            # Convert old format to new format
            existing_hands = {"hands": []}
        elif isinstance(existing_data, dict) and "hands" in existing_data:
            existing_hands = existing_data
        else:
            existing_hands = {"hands": []}
    except (json.JSONDecodeError, TypeError):
        existing_hands = {"hands": []}
    
    # Add new hand
    hand_name = data.get('hand_name', f'Hand {len(existing_hands["hands"]) + 1}')
    new_hand = {
        "name": hand_name,
        "cards": selected_cards,
        "created_at": datetime.now().isoformat()
    }
    
    existing_hands["hands"].append(new_hand)
    
    # Keep only the 3 most recent hands
    if len(existing_hands["hands"]) > 3:
        existing_hands["hands"] = existing_hands["hands"][-3:]
    
    current_user.misc1 = json.dumps(existing_hands)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Hand saved successfully!",
        "selected_cards": selected_cards
    })

@app.route('/api/get-hand', methods=['GET'])
@login_required
def get_hand():
    """Get the user's saved hands"""
    try:
        saved_hands = current_user.misc1
        if saved_hands:
            hands_data = json.loads(saved_hands)
            # Handle both old format (list) and new format (dict)
            if isinstance(hands_data, list):
                # Old format - return empty hands list
                return jsonify({
                    "success": True,
                    "hands": []
                })
            elif isinstance(hands_data, dict) and "hands" in hands_data:
                return jsonify({
                    "success": True,
                    "hands": hands_data["hands"]
                })
            else:
                return jsonify({
                    "success": True,
                    "hands": []
                })
        else:
            return jsonify({
                "success": True,
                "hands": []
            })
    except (json.JSONDecodeError, TypeError):
        return jsonify({
            "success": True,
            "hands": []
        })

@app.route('/api/delete-hand', methods=['POST'])
@login_required
def delete_hand():
    """Delete a specific hand by index"""
    data = request.get_json()
    hand_index = data.get('hand_index')
    
    if hand_index is None:
        return jsonify({
            "success": False,
            "message": "Hand index is required."
        })
    
    try:
        saved_hands = current_user.misc1
        if saved_hands:
            hands_data = json.loads(saved_hands)
            # Handle both old format (list) and new format (dict)
            if isinstance(hands_data, list):
                # Old format - no hands to delete
                return jsonify({
                    "success": False,
                    "message": "No hands found."
                })
            elif isinstance(hands_data, dict) and "hands" in hands_data:
                hands = hands_data["hands"]
                
                if 0 <= hand_index < len(hands):
                    # Remove the hand at the specified index
                    deleted_hand = hands.pop(hand_index)
                    hands_data["hands"] = hands
                    current_user.misc1 = json.dumps(hands_data)
                    db.session.commit()
                    
                    return jsonify({
                        "success": True,
                        "message": f"Hand '{deleted_hand['name']}' deleted successfully.",
                        "hands": hands
                    })
                else:
                    return jsonify({
                        "success": False,
                        "message": "Invalid hand index."
                    })
            else:
                return jsonify({
                    "success": False,
                    "message": "No hands found."
                })
        else:
            return jsonify({
                "success": False,
                "message": "No hands found."
            })
    except (json.JSONDecodeError, TypeError):
        return jsonify({
            "success": False,
            "message": "Error reading hands data."
        })

@app.route('/api/get-user-hands', methods=['GET'])
@login_required
def get_user_hands():
    """Get user's hands for game hand selection"""
    try:
        saved_hands = current_user.misc1
        if saved_hands:
            hands_data = json.loads(saved_hands)
            # Handle both old format (list) and new format (dict)
            if isinstance(hands_data, list):
                # Old format - return empty hands list
                return jsonify({
                    "success": True,
                    "hands": []
                })
            elif isinstance(hands_data, dict) and "hands" in hands_data:
                return jsonify({
                    "success": True,
                    "hands": hands_data["hands"]
                })
            else:
                return jsonify({
                    "success": True,
                    "hands": []
                })
        else:
            return jsonify({
                "success": True,
                "hands": []
            })
    except (json.JSONDecodeError, TypeError):
        return jsonify({
            "success": True,
            "hands": []
        })

@app.route('/api/get-current-hand', methods=['GET'])
@login_required
def get_current_hand():
    """Get the user's currently selected hand"""
    try:
        # Get current hand from misc2 field
        current_hand_data = current_user.misc2
        if current_hand_data:
            current_hand = json.loads(current_hand_data)
            return jsonify({
                "success": True,
                "current_hand": current_hand
            })
        else:
            return jsonify({
                "success": True,
                "current_hand": None
            })
    except (json.JSONDecodeError, TypeError):
        return jsonify({
            "success": True,
            "current_hand": None
        })

@app.route('/api/set-current-hand', methods=['POST'])
@login_required
def set_current_hand():
    """Set the user's current hand for games"""
    data = request.get_json()
    hand_index = data.get('hand_index')
    
    if hand_index is None:
        return jsonify({
            "success": False,
            "message": "Hand index is required."
        })
    
    try:
        # Get user's hands
        saved_hands = current_user.misc1
        if not saved_hands:
            return jsonify({
                "success": False,
                "message": "No hands found. Please create a hand first."
            })
        
        hands_data = json.loads(saved_hands)
        # Handle both old format (list) and new format (dict)
        if isinstance(hands_data, list):
            # Old format - no hands to select from
            return jsonify({
                "success": False,
                "message": "No hands found. Please create a hand first."
            })
        elif isinstance(hands_data, dict) and "hands" in hands_data:
            hands = hands_data["hands"]
            
            if 0 <= hand_index < len(hands):
                # Set the selected hand as current
                selected_hand = hands[hand_index]
                current_user.misc2 = json.dumps(selected_hand)
                db.session.commit()
                
                return jsonify({
                    "success": True,
                    "message": f"Hand '{selected_hand['name']}' set as current battle hand.",
                    "hand_name": selected_hand['name']
                })
            else:
                return jsonify({
                    "success": False,
                    "message": "Invalid hand index."
                })
        else:
            return jsonify({
                "success": False,
                "message": "No hands found. Please create a hand first."
            })
    except (json.JSONDecodeError, TypeError):
        return jsonify({
            "success": False,
            "message": "Error reading hands data."
        })

@app.route('/auth', methods=['GET', 'POST'])
def auth():
    if request.method == 'POST':
        email = request.form.get('email')
        if email:
            # Check if user exists
            user = User.query.filter_by(email=email).first()
            if user:
                # User exists - redirect to login
                session['auth_email'] = email
                return redirect(url_for('login'))
            else:
                # User doesn't exist - redirect to register
                session['auth_email'] = email
                return redirect(url_for('register'))
    
    return render_template('auth.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    email = session.get('auth_email')
    if not email:
        return redirect(url_for('auth'))
    
    if request.method == 'POST':
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password, password):
            login_user(user)
            session.pop('auth_email', None)
            return redirect(url_for('index'))
        else:
            flash('Invalid password', 'error')
    
    return render_template('login.html', email=email)

@app.route('/register', methods=['GET', 'POST'])
def register():
    email = session.get('auth_email')
    if not email:
        return redirect(url_for('auth'))
    
    if request.method == 'POST':
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if password and confirm_password:
            if password == confirm_password:
                hashed_password = generate_password_hash(password)
                new_user = User(
                    email=email,
                    password=hashed_password,
                    date_of_signup=datetime.now().date()
                )
                db.session.add(new_user)
                db.session.commit()
                
                # Create user collection with cards 1-10 unlocked
                initial_cards = list(range(1, 11))  # Cards 1-10
                user_collection = UserCollection(
                    user_id=new_user.id,
                    unlocked_cards=initial_cards
                )
                db.session.add(user_collection)
                db.session.commit()
                
                login_user(new_user)
                session.pop('auth_email', None)
                flash('Account created successfully! You now have cards 1-10 in your collection!', 'success')
                return redirect(url_for('index'))
            else:
                flash('Passwords do not match', 'error')
        else:
            flash('Please fill in all fields', 'error')
    
    return render_template('register.html', email=email)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth'))

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5002)




