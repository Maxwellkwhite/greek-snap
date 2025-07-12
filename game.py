import random
from cards_data import CHARACTERS
from locations_data import LOCATIONS
from effect_system import EffectHandler

class Game:
    def __init__(self, player_deck_ids=None):
        self.turn = 1
        self.max_turns = 5
        self.player_hand = []
        self.opponent_hand = []
        
        # Set up player deck based on selected hand
        if player_deck_ids:
            # Create deck from selected card IDs (only one copy of each)
            self.player_deck = []
            for card_id in player_deck_ids:
                card = next((c for c in CHARACTERS if c['id'] == card_id), None)
                if card:
                    self.player_deck.append(card)
            # If we have fewer than 10 cards, add some random cards to fill the deck
            if len(self.player_deck) < 10:
                remaining_cards = [c for c in CHARACTERS if c['id'] not in player_deck_ids]
                random.shuffle(remaining_cards)
                self.player_deck.extend(remaining_cards[:10 - len(self.player_deck)])
        else:
            # Default deck (all cards)
            self.player_deck = CHARACTERS.copy()
        
        # Opponent always uses all cards
        self.opponent_deck = CHARACTERS.copy()
        
        self.locations = []
        self.player_energy = 1
        self.opponent_energy = 1
        self.player_unused_energy = 0
        self.opponent_unused_energy = 0
        self.game_over = False
        self.winner = None
        self.pending_on_reveal_effects = []  # Store On Reveal effects to process at turn end
        self.pending_location_draw_effects = []  # Store location draw effects to process at turn end
        self.player_hand_cost_increase = 0  # Global cost increase for player's hand
        self.opponent_hand_cost_increase = 0  # Global cost increase for opponent's hand
        
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
                "effect_type": loc["effect_type"],
                "effect_value": loc["effect_value"],
                "background_image": loc.get("background_image", ""),
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
        
        # Calculate actual cost considering location effects
        actual_cost = self.calculate_card_cost(card, location, player)
        
        if actual_cost > energy:
            return False, "Not enough energy"
        
        # Check if location is full (4 card limit)
        player_cards_at_location = len(location["player_cards"]) if player == "player" else len(location["opponent_cards"])
        if player_cards_at_location >= 4:
            return False, "Location is full (maximum 4 cards)"
        
        # Play the card
        if player == "player":
            location["player_cards"].append(card)
            self.player_energy -= actual_cost
        else:
            location["opponent_cards"].append(card)
            self.opponent_energy -= actual_cost
        
        # Remove card from hand
        hand.pop(card_index)
        
        # Apply location effects when card is played
        EffectHandler.apply_location_effect(location, player, self)
        
        # Handle immediate effects (like destroy) right away
        if card.get("ability_type") == "on_reveal" and card.get("ability_effect"):
            effect = card["ability_effect"]
            if effect["type"] == "destroy_card" or effect["type"] == "increase_hand_costs":
                # These effects happen immediately
                EffectHandler.apply_card_ability(card, location, player, self)
            elif effect["type"] != "reduce_opponent_power":  # Power reductions are now ongoing
                # Other on_reveal effects are processed at turn end
                self.pending_on_reveal_effects.append({
                    "card": card,
                    "location_index": location_index,
                    "player": player
                })
        
        return True, "Card played successfully"
    
    def calculate_card_cost(self, card, location, player="player"):
        """Calculate the actual cost of a card considering location effects and hand cost increases"""
        base_cost = card["cost"]
        cost_modifier = EffectHandler.calculate_card_cost_modifier(card, location)
        
        # Apply global cost reductions from all locations
        global_cost_reduction = 0
        for loc in self.locations:
            if loc.get("effect_type") == "cost_reduction":
                global_cost_reduction += loc["effect_value"]
        
        # Apply hand cost increases
        hand_cost_increase = self.player_hand_cost_increase if player == "player" else self.opponent_hand_cost_increase
        
        total_cost = max(0, base_cost + cost_modifier + hand_cost_increase - global_cost_reduction)
        return total_cost
    
    def apply_location_effects(self, location_index, player):
        """Apply location effects when a card is played"""
        location = self.locations[location_index]
        EffectHandler.apply_location_effect(location, player, self)
    
    def process_on_reveal_ability(self, card, location_index, player):
        """Process On Reveal abilities when a card is played"""
        location = self.locations[location_index]
        EffectHandler.apply_card_ability(card, location, player, self)
    
    def calculate_location_power(self, location, player):
        """Calculate total power for a player at a location, including Ongoing abilities and location effects"""
        cards = location["player_cards"] if player == "player" else location["opponent_cards"]
        opponent_cards = location["opponent_cards"] if player == "player" else location["player_cards"]
        total_power = 0
        
        for card in cards:
            base_power = card["power"]
            power_modifier = EffectHandler.calculate_card_power_modifier(card, location, cards, opponent_cards)
            total_power += base_power + power_modifier
        
        return total_power
    
    def calculate_card_power(self, card, location, player):
        """Calculate the modified power of a single card, including Ongoing effects and location effects"""
        base_power = card["power"]
        cards = location["player_cards"] if player == "player" else location["opponent_cards"]
        opponent_cards = location["opponent_cards"] if player == "player" else location["player_cards"]
        power_modifier = EffectHandler.calculate_card_power_modifier(card, location, cards, opponent_cards)
        return base_power + power_modifier

    def end_turn(self):
        # Process all pending On Reveal effects
        for effect in self.pending_on_reveal_effects:
            self.process_on_reveal_ability(effect["card"], effect["location_index"], effect["player"])
        self.pending_on_reveal_effects.clear()
        
        # Process all pending location draw effects
        EffectHandler.process_pending_location_draw_effects(self)
        
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
        
        # Calculate modified costs for cards in hand
        player_hand_with_costs = []
        for card in self.player_hand:
            card_data = card.copy()
            # Calculate costs for each location
            card_data["location_costs"] = {}
            for i, location in enumerate(self.locations):
                card_data["location_costs"][i] = self.calculate_card_cost(card, location, "player")
            player_hand_with_costs.append(card_data)
        
        return {
            "turn": self.turn,
            "max_turns": self.max_turns,
            "player_hand": player_hand_with_costs,
            "opponent_hand": self.opponent_hand,
            "player_energy": self.player_energy,
            "opponent_energy": self.opponent_energy,
            "player_unused_energy": self.player_unused_energy,
            "opponent_unused_energy": self.opponent_unused_energy,
            "locations": locations_with_power,
            "game_over": self.game_over,
            "winner": self.winner,
            "player_hand_cost_increase": self.player_hand_cost_increase,
            "opponent_hand_cost_increase": self.opponent_hand_cost_increase
        } 