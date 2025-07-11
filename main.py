from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_bootstrap import Bootstrap
import os
import random
import json
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

# Global game instance
current_game = None



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
        from xp_system import LEVEL_REWARDS
        
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
                             card_id_to_name=card_id_to_name)
    else:
        return render_template('index.html', 
                             user=current_user,
                             level=1,
                             xp=0,
                             xp_for_next=100,
                             progress=0,
                             pending_rewards=[],
                             level_rewards={},
                             card_id_to_name={})

@app.route('/game')
def game():
    global current_game
    if current_game is None:
        current_game = Game()
    return render_template('game.html', game=current_game, characters=CHARACTERS)

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

@app.route('/api/reset-user', methods=['POST'])
@login_required
def reset_user():
    """Reset all user data (XP, collection, etc.)"""
    try:
        # Reset XP to 0
        current_user.xp = 0
        current_user.last_daily_win = None
        
        # Reset collection
        user_collection = UserCollection.query.filter_by(user_id=current_user.id).first()
        if user_collection:
            # Clear the collection properly
            user_collection.unlocked_cards = []
            user_collection.date_updated = func.now()
            db.session.commit()
            db.session.refresh(user_collection)
            print(f"DEBUG: Reset - Cleared collection for user {current_user.id}")
            print(f"DEBUG: Reset - Collection now has {len(user_collection.unlocked_cards)} cards")
        else:
            # Create new collection if it doesn't exist
            user_collection = UserCollection(user_id=current_user.id, unlocked_cards=[])
            db.session.add(user_collection)
            db.session.commit()
            print(f"DEBUG: Reset - Created new empty collection for user {current_user.id}")
        
        # Verify the reset worked
        db.session.refresh(user_collection)
        final_card_count = len(user_collection.unlocked_cards) if user_collection.unlocked_cards else 0
        print(f"DEBUG: Reset - Final card count: {final_card_count}")
        
        return jsonify({
            "success": True,
            "message": "User data reset successfully! All XP and cards have been cleared.",
            "new_xp": 0,
            "new_level": 1,
            "unlocked_cards": []
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
@login_required
def new_game():
    global current_game
    current_game = Game()
    
    return jsonify({
        "success": True,
        "game_state": current_game.get_game_state()
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
                login_user(new_user)
                session.pop('auth_email', None)
                flash('Account created successfully!', 'success')
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




