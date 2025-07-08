# Locations Data - Centralized location definitions
# This file makes it easy to add new locations and manage their effects

LOCATIONS = [
    {
        "name": "Asgard",
        "effect": "All cards cost 1 less.",
        "effect_type": "cost_reduction",
        "effect_value": 1,
        "description": "Reduces the cost of all cards played here"
    },
    {
        "name": "Wakanda", 
        "effect": "Add 1 power to all cards here.",
        "effect_type": "power_boost",
        "effect_value": 1,
        "description": "Boosts power of all cards at this location"
    },
    {
        "name": "New York",
        "effect": "Draw a card.",
        "effect_type": "draw_card",
        "effect_value": 1,
        "description": "Draws a card when any card is played here"
    },
    {
        "name": "Sanctum Sanctorum",
        "effect": "If you have one card here, +5 power.",
        "effect_type": "single_card_bonus",
        "effect_value": 5,
        "description": "Gives +5 power when only one card is present"
    },
]

# Template for adding new locations:
"""
{
    "name": "New Location",
    "effect": "Description of effect.",
    "effect_type": "effect_type",
    "effect_value": 1,
    "description": "What this location does"
}
"""

# Available effect types for locations:
LOCATION_EFFECT_TYPES = {
    "cost_reduction": "Reduces the cost of cards played at this location",
    "power_boost": "Increases the power of cards at this location",
    "draw_card": "Draws cards when cards are played at this location",
    "single_card_bonus": "Gives bonus power when only one card is present",
    # Add more effect types here as needed
} 