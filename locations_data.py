# Locations Data - Centralized location definitions
# This file makes it easy to add new locations and manage their effects

LOCATIONS = [
    {
        "name": "Mt. Olympus",
        "effect": "All cards cost 1 less.",
        "effect_type": "cost_reduction",
        "effect_value": 1,
        "description": "Reduces the cost of all cards played here",
        "background_image": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center"
    },
    {
        "name": "The Underworld", 
        "effect": "All cards here have -2 Power.",
        "effect_type": "reduce_all_power",
        "effect_value": 2,
        "description": "Reduces power of all cards at this location",
        "background_image": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop&crop=center"
    },
    {
        "name": "Oracle of Delphi",
        "effect": "Draw a card.",
        "effect_type": "draw_card",
        "effect_value": 1,
        "description": "Draws a card when any card is played here",
        "background_image": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&crop=center"
    },
    {
        "name": "Labryinth",
        "effect": "If you have one card here, +4 power.",
        "effect_type": "single_card_bonus",
        "effect_value": 4,
        "description": "Gives +4 power when only one card is present",
        "background_image": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center"
    },
    {
        "name": "Athens",
        "effect": "All cards here have +1 Power.",
        "effect_type": "power_boost",
        "effect_value": 1,
        "description": "Increases power of all cards at this location",
        "background_image": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&h=600&fit=crop&crop=center"
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
    "reduce_all_power": "Reduces the power of all cards at this location",
    "draw_card": "Draws cards when cards are played at this location",
    "single_card_bonus": "Gives bonus power when only one card is present",
    # Add more effect types here as needed
} 