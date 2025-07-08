# Example: How to add new cards and locations
# This file demonstrates the new modular system

# To add a new card, simply add it to cards_data.py:
NEW_CARD_EXAMPLE = {
    "id": 11,
    "name": "Black Panther",
    "power": 4,
    "cost": 4,
    "ability": "On Reveal: Double this card's Power.",
    "ability_type": "on_reveal",
    "ability_effect": {
        "type": "double_power",
        "description": "Doubles the card's power when played"
    }
}

# To add a new location, simply add it to locations_data.py:
NEW_LOCATION_EXAMPLE = {
    "name": "Savage Land",
    "effect": "Cards here can't be destroyed.",
    "effect_type": "indestructible",
    "effect_value": 1,
    "description": "Makes cards at this location immune to destruction"
}

# To add a new effect type, add it to effect_system.py:
NEW_EFFECT_EXAMPLE = {
    "double_power": {
        "description": "Doubles the power of a card",
        "parameters": [],
        "handler": lambda effect, player, game: None  # Would be implemented in EffectHandler
    },
    "indestructible": {
        "description": "Makes cards immune to destruction",
        "parameters": ["value"],
        "handler": None  # Would be implemented in EffectHandler
    }
}

# The beauty of this system:
# 1. Data is separated from logic
# 2. Adding new cards/locations is just adding data
# 3. Adding new effects requires minimal code changes
# 4. Everything is centralized and easy to manage
# 5. No need to modify the main game logic for most additions

print("This system makes it super easy to add new content!")
print("Just add the data and the system handles the rest!") 