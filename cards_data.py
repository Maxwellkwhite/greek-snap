# Cards Data - Centralized card definitions
# This file makes it easy to add new cards and manage their abilities

CHARACTERS = [
    {
        "id": 1,
        "name": "Iron Man",
        "power": 5,
        "cost": 5,
        "ability": "Ongoing: Your other cards here have +2 Power.",
        "ability_type": "ongoing",
        "ability_effect": {
            "type": "power_boost", 
            "value": 2, 
            "target": "other_cards",
            "description": "Boost other cards at this location"
        }
    },
    {
        "id": 2,
        "name": "Captain America",
        "power": 3,
        "cost": 3,
        "ability": "Ongoing: Your other cards here have +1 Power.",
        "ability_type": "ongoing",
        "ability_effect": {
            "type": "power_boost", 
            "value": 1, 
            "target": "other_cards",
            "description": "Boost other cards at this location"
        }
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
        "ability_effect": {
            "type": "draw_cards", 
            "value": 1,
            "description": "Draw cards when played"
        }
    },
    {
        "id": 5,
        "name": "Thor",
        "power": 4,
        "cost": 4,
        "ability": "On Reveal: Draw 2 cards.",
        "ability_type": "on_reveal",
        "ability_effect": {
            "type": "draw_cards", 
            "value": 2,
            "description": "Draw cards when played"
        }
    },
    {
        "id": 6,
        "name": "Spider-Man",
        "power": 3,
        "cost": 3,
        "ability": "Ongoing: Opponent's cards here have -1 Power.",
        "ability_type": "ongoing",
        "ability_effect": {
            "type": "reduce_opponent_power", 
            "value": 1,
            "description": "Reduce opponent card power"
        }
    },
    {
        "id": 7,
        "name": "Doctor Strange",
        "power": 3,
        "cost": 3,
        "ability": "Ongoing: Opponent's cards here have -2 Power.",
        "ability_type": "ongoing",
        "ability_effect": {
            "type": "reduce_opponent_power", 
            "value": 2,
            "description": "Reduce opponent card power"
        }
    },
    {
        "id": 8,
        "name": "Scarlet Witch",
        "power": 2,
        "cost": 2,
        "ability": "On Reveal: Draw 1 card.",
        "ability_type": "on_reveal",
        "ability_effect": {
            "type": "draw_cards", 
            "value": 1,
            "description": "Draw cards when played"
        }
    },
    {
        "id": 9,
        "name": "Ant-Man",
        "power": 1,
        "cost": 1,
        "ability": "Ongoing: Your other cards here have +1 Power.",
        "ability_type": "ongoing",
        "ability_effect": {
            "type": "power_boost", 
            "value": 1, 
            "target": "other_cards",
            "description": "Boost other cards at this location"
        }
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

# Template for adding new cards:
"""
{
    "id": 11,
    "name": "New Character",
    "power": 4,
    "cost": 3,
    "ability": "Description of ability.",
    "ability_type": "ongoing|on_reveal|none",
    "ability_effect": {
        "type": "effect_type",
        "value": 1,
        "target": "optional_target",
        "description": "What this effect does"
    }
}
""" 