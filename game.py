import random

# Marvel Snap Characters Data
CHARACTERS = [
    {
        "id": 1,
        "name": "Iron Man",
        "power": 5,
        "cost": 5,
        "ability": "Ongoing: Your other cards here have +2 Power.",
        "ability_type": "ongoing",
        "ability_effect": {"type": "power_boost", "value": 2, "target": "other_cards"}
    },
    {
        "id": 2,
        "name": "Captain America",
        "power": 3,
        "cost": 3,
        "ability": "Ongoing: Your other cards here have +1 Power.",
        "ability_type": "ongoing",
        "ability_effect": {"type": "power_boost", "value": 1, "target": "other_cards"}
    },
    {
        "id": 3,
        "name": "Hulk",
        "power": 12,
        "cost": 6,
        "ability": "No ability.",
        "ability_type": "none",
        "ability_effect": None
    },
    {
        "id": 4,
        "name": "Black Widow",
        "power": 1,
        "cost": 1,
        "ability": "On Reveal: Draw 1 card.",
        "ability_type": "on_reveal",
        "ability_effect": {"type": "draw_cards", "value": 1}
    },
    {
        "id": 5,
        "name": "Thor",
        "power": 4,
        "cost": 4,
        "ability": "On Reveal: Draw 2 cards.",
        "ability_type": "on_reveal",
        "ability_effect": {"type": "draw_cards", "value": 2}
    },
    {
        "id": 6,
        "name": "Spider-Man",
        "power": 3,
        "cost": 3,
        "ability": "Ongoing: Opponent's cards here have -1 Power.",
        "ability_type": "ongoing",
        "ability_effect": {"type": "reduce_opponent_power", "value": 1}
    },
    {
        "id": 7,
        "name": "Doctor Strange",
        "power": 3,
        "cost": 3,
        "ability": "Ongoing: Opponent's cards here have -2 Power.",
        "ability_type": "ongoing",
        "ability_effect": {"type": "reduce_opponent_power", "value": 2}
    },
    {
        "id": 8,
        "name": "Scarlet Witch",
        "power": 2,
        "cost": 2,
        "ability": "On Reveal: Draw 1 card.",
        "ability_type": "on_reveal",
        "ability_effect": {"type": "draw_cards", "value": 1}
    },
    {
        "id": 9,
        "name": "Ant-Man",
        "power": 1,
        "cost": 1,
        "ability": "Ongoing: Your other cards here have +1 Power.",
        "ability_type": "ongoing",
        "ability_effect": {"type": "power_boost", "value": 1, "target": "other_cards"}
    },
    {
        "id": 10,
        "name": "Wasp",
        "power": 1,
        "cost": 0,
        "ability": "No ability.",
        "ability_type": "none",
        "ability_effect": None
    }
]

# Remove special cards since we're simplifying
SPECIAL_CARDS = {}

# Locations
LOCATIONS = [
    {"name": "Asgard", "effect": "Cards here cost 1 less."},
    {"name": "Wakanda", "effect": "Cards here can't be destroyed."},
    {"name": "New York", "effect": "Cards here have +1 Power."},
    {"name": "Sanctum Sanctorum", "effect": "Cards here can't be moved."},
    {"name": "Stark Tower", "effect": "After turn 3, cards here have +2 Power."}
]

class Game:
    def __init__(self):
        self.turn = 1
        self.max_turns = 5
        self.player_hand = []
        self.opponent_hand = []
        self.player_deck = CHARACTERS.copy()
        self.opponent_deck = CHARACTERS.copy()
        self.locations = []
        self.player_energy = 1
        self.opponent_energy = 1
        self.player_unused_energy = 0
        self.opponent_unused_energy = 0
        self.game_over = False
        self.winner = None
        self.pending_on_reveal_effects = []  # Store On Reveal effects to process at turn end
        
        # Shuffle decks
        random.shuffle(self.player_deck)
        random.shuffle(self.opponent_deck)
        
        # Draw initial hands
        self.draw_cards(3, "player")
        self.draw_cards(3, "opponent")
        
        # Set up locations
        self.setup_locations()
    
    def draw_cards(self, count, player):
        deck = self.player_deck if player == "player" else self.opponent_deck
        hand = self.player_hand if player == "player" else self.opponent_hand
        
        for _ in range(min(count, len(deck))):
            if deck:
                card = deck.pop()
                hand.append(card)
    
    def setup_locations(self):
        # Select 3 random locations
        selected_locations = random.sample(LOCATIONS, 3)
        self.locations = [
            {
                "name": loc["name"],
                "effect": loc["effect"],
                "player_cards": [],
                "opponent_cards": []
            }
            for loc in selected_locations
        ]
    
    def play_card(self, card_index, location_index, player):
        if self.game_over:
            return False, "Game is over"
        
        hand = self.player_hand if player == "player" else self.opponent_hand
        energy = self.player_energy if player == "player" else self.opponent_energy
        location = self.locations[location_index]
        
        if card_index >= len(hand):
            return False, "Invalid card index"
        
        card = hand[card_index]
        
        if card["cost"] > energy:
            return False, "Not enough energy"
        
        # Check if location is full (4 card limit)
        player_cards_at_location = len(location["player_cards"]) if player == "player" else len(location["opponent_cards"])
        if player_cards_at_location >= 4:
            return False, "Location is full (maximum 4 cards)"
        
        # Play the card
        if player == "player":
            location["player_cards"].append(card)
            self.player_energy -= card["cost"]
        else:
            location["opponent_cards"].append(card)
            self.opponent_energy -= card["cost"]
        
        # Remove card from hand
        hand.pop(card_index)
        
        # Store On Reveal abilities to process at turn end (only for non-power-reduction effects)
        if card.get("ability_type") == "on_reveal" and card.get("ability_effect"):
            effect = card["ability_effect"]
            if effect["type"] != "reduce_opponent_power":  # Power reductions are now ongoing
                self.pending_on_reveal_effects.append({
                    "card": card,
                    "location_index": location_index,
                    "player": player
                })
        
        return True, "Card played successfully"
    
    def process_on_reveal_ability(self, card, location_index, player):
        """Process On Reveal abilities when a card is played"""
        if card.get("ability_type") != "on_reveal" or not card.get("ability_effect"):
            return
        
        effect = card["ability_effect"]
        effect_type = effect["type"]
        
        if effect_type == "draw_cards":
            # Draw cards
            self.draw_cards(effect["value"], player)
    
    def calculate_location_power(self, location, player):
        """Calculate total power for a player at a location, including Ongoing abilities"""
        cards = location["player_cards"] if player == "player" else location["opponent_cards"]
        total_power = 0
        
        for card in cards:
            base_power = card["power"]
            modified_power = base_power
            
            # Apply power boosts from other Ongoing cards
            for other_card in cards:
                if (other_card != card and 
                    other_card.get("ability_type") == "ongoing" and 
                    other_card.get("ability_effect") and
                    other_card["ability_effect"]["type"] == "power_boost" and
                    other_card["ability_effect"]["target"] == "other_cards"):
                    modified_power += other_card["ability_effect"]["value"]
            
            # Apply ongoing power reductions from opponent's cards
            opponent_cards = location["opponent_cards"] if player == "player" else location["player_cards"]
            for opponent_card in opponent_cards:
                if (opponent_card.get("ability_type") == "ongoing" and 
                    opponent_card.get("ability_effect") and
                    opponent_card["ability_effect"]["type"] == "reduce_opponent_power"):
                    modified_power -= opponent_card["ability_effect"]["value"]
            
            total_power += modified_power
        
        return total_power
    
    def calculate_card_power(self, card, location, player):
        """Calculate the modified power of a single card, including Ongoing effects"""
        base_power = card["power"]
        modified_power = base_power
        
        # Apply power boosts from other Ongoing cards
        cards = location["player_cards"] if player == "player" else location["opponent_cards"]
        for other_card in cards:
            if (other_card != card and 
                other_card.get("ability_type") == "ongoing" and 
                other_card.get("ability_effect") and
                other_card["ability_effect"]["type"] == "power_boost" and
                other_card["ability_effect"]["target"] == "other_cards"):
                modified_power += other_card["ability_effect"]["value"]
        
        # Apply ongoing power reductions from opponent's cards
        opponent_cards = location["opponent_cards"] if player == "player" else location["player_cards"]
        for opponent_card in opponent_cards:
            if (opponent_card.get("ability_type") == "ongoing" and 
                opponent_card.get("ability_effect") and
                opponent_card["ability_effect"]["type"] == "reduce_opponent_power"):
                modified_power -= opponent_card["ability_effect"]["value"]
        
        return modified_power

    def end_turn(self):
        # Process all pending On Reveal effects
        for effect in self.pending_on_reveal_effects:
            self.process_on_reveal_ability(effect["card"], effect["location_index"], effect["player"])
        self.pending_on_reveal_effects.clear()
        
        if self.turn < self.max_turns:
            # Store unused energy for next turn
            self.player_unused_energy = self.player_energy
            self.opponent_unused_energy = self.opponent_energy
            
            self.turn += 1
            
            # Calculate new energy: base energy for turn + unused energy from previous turn
            base_energy = min(self.turn, 6)
            self.player_energy = base_energy + self.player_unused_energy
            self.opponent_energy = base_energy + self.opponent_unused_energy
            
            # Draw cards
            self.draw_cards(1, "player")
            self.draw_cards(1, "opponent")
        else:
            self.game_over = True
            self.calculate_winner()
    
    def calculate_winner(self):
        player_score = 0
        opponent_score = 0
        
        for location in self.locations:
            player_power = self.calculate_location_power(location, "player")
            opponent_power = self.calculate_location_power(location, "opponent")
            
            if player_power > opponent_power:
                player_score += 1
            elif opponent_power > player_power:
                opponent_score += 1
        
        if player_score > opponent_score:
            self.winner = "player"
        elif opponent_score > player_score:
            self.winner = "opponent"
        else:
            self.winner = "tie" 

    def get_game_state(self):
        """Get the current game state with calculated power for each location"""
        locations_with_power = []
        for location in self.locations:
            player_power = self.calculate_location_power(location, "player")
            opponent_power = self.calculate_location_power(location, "opponent")
            
            # Calculate modified power for each card
            player_cards_with_power = []
            for card in location["player_cards"]:
                card_data = card.copy()
                card_data["modified_power"] = self.calculate_card_power(card, location, "player")
                player_cards_with_power.append(card_data)
            
            opponent_cards_with_power = []
            for card in location["opponent_cards"]:
                card_data = card.copy()
                card_data["modified_power"] = self.calculate_card_power(card, location, "opponent")
                opponent_cards_with_power.append(card_data)
            
            location_data = location.copy()
            location_data["player_cards"] = player_cards_with_power
            location_data["opponent_cards"] = opponent_cards_with_power
            location_data["player_power"] = player_power
            location_data["opponent_power"] = opponent_power
            locations_with_power.append(location_data)
        
        return {
            "turn": self.turn,
            "max_turns": self.max_turns,
            "player_hand": self.player_hand,
            "opponent_hand": self.opponent_hand,
            "player_energy": self.player_energy,
            "opponent_energy": self.opponent_energy,
            "player_unused_energy": self.player_unused_energy,
            "opponent_unused_energy": self.opponent_unused_energy,
            "locations": locations_with_power,
            "game_over": self.game_over,
            "winner": self.winner
        } 