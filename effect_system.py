# Effect System - Centralized effect handling
# This system makes it easy to add new effects without modifying the main game logic

class EffectHandler:
    """Centralized handler for all card and location effects"""
    
    @staticmethod
    def apply_card_ability(card, location, player, game_instance):
        """Apply a card's ability effect"""
        if not card.get("ability_effect"):
            return
        
        effect = card["ability_effect"]
        effect_type = effect["type"]
        
        if effect_type == "draw_cards":
            EffectHandler._draw_cards(effect["value"], player, game_instance)
        elif effect_type == "power_boost":
            # Power boosts are handled in power calculation, not here
            pass
        elif effect_type == "reduce_opponent_power":
            # Power reductions are handled in power calculation, not here
            pass
    
    @staticmethod
    def apply_location_effect(location, player, game_instance):
        """Apply a location's effect when a card is played"""
        effect_type = location.get("effect_type")
        
        if effect_type == "draw_card":
            # Delay draw card effects until end of turn
            game_instance.pending_location_draw_effects.append({
                "player": player,
                "count": location["effect_value"]
            })
    
    @staticmethod
    def process_pending_location_draw_effects(game_instance):
        """Process all pending location draw effects at end of turn"""
        for effect in game_instance.pending_location_draw_effects:
            EffectHandler._draw_cards(effect["count"], effect["player"], game_instance)
        game_instance.pending_location_draw_effects.clear()
    
    @staticmethod
    def calculate_card_cost_modifier(card, location):
        """Calculate cost modifications from location effects"""
        effect_type = location.get("effect_type")
        
        if effect_type == "cost_reduction":
            return -location["effect_value"]
        
        return 0
    
    @staticmethod
    def calculate_card_power_modifier(card, location, player_cards, opponent_cards):
        """Calculate power modifications from location and card effects"""
        total_modifier = 0
        
        # Location effects
        effect_type = location.get("effect_type")
        if effect_type == "power_boost":
            total_modifier += location["effect_value"]
        elif effect_type == "single_card_bonus" and len(player_cards) == 1:
            total_modifier += location["effect_value"]
        
        # Card ability effects (ongoing)
        for other_card in player_cards:
            if (other_card != card and 
                other_card.get("ability_type") == "ongoing" and 
                other_card.get("ability_effect") and
                other_card["ability_effect"]["type"] == "power_boost" and
                other_card["ability_effect"]["target"] == "other_cards"):
                total_modifier += other_card["ability_effect"]["value"]
        
        # Opponent card effects (ongoing)
        for opponent_card in opponent_cards:
            if (opponent_card.get("ability_type") == "ongoing" and 
                opponent_card.get("ability_effect") and
                opponent_card["ability_effect"]["type"] == "reduce_opponent_power"):
                total_modifier -= opponent_card["ability_effect"]["value"]
        
        return total_modifier
    
    @staticmethod
    def _draw_cards(count, player, game_instance):
        """Helper method to draw cards"""
        game_instance.draw_cards(count, player)

# Effect Registry - Easy way to add new effects
EFFECT_REGISTRY = {
    # Card effects
    "draw_cards": {
        "description": "Draw cards when triggered",
        "parameters": ["value"],
        "handler": lambda effect, player, game: game.draw_cards(effect["value"], player)
    },
    "power_boost": {
        "description": "Boost power of cards",
        "parameters": ["value", "target"],
        "handler": None  # Handled in power calculation
    },
    "reduce_opponent_power": {
        "description": "Reduce opponent card power",
        "parameters": ["value"],
        "handler": None  # Handled in power calculation
    },
    
    # Location effects
    "cost_reduction": {
        "description": "Reduce cost of cards",
        "parameters": ["value"],
        "handler": None  # Handled in cost calculation
    },
    "single_card_bonus": {
        "description": "Bonus when only one card present",
        "parameters": ["value"],
        "handler": None  # Handled in power calculation
    }
}

# Template for adding new effects:
"""
# Add to EFFECT_REGISTRY:
"new_effect_type": {
    "description": "What this effect does",
    "parameters": ["param1", "param2"],
    "handler": lambda effect, player, game: your_custom_logic(effect, player, game)
}

# Then implement the logic in the appropriate method above
""" 