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
    return render_template('index.html', user=current_user)

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
    
    # Get all cards and mark which ones are unlocked
    all_cards = CHARACTERS.copy()
    unlocked_card_ids = set(user_collection.unlocked_cards)
    
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
    
    return jsonify({
        "unlocked_cards": user_collection.unlocked_cards,
        "total_cards": len(CHARACTERS),
        "completion_percentage": round((len(user_collection.unlocked_cards) / len(CHARACTERS)) * 100, 1)
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




