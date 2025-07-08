# Card Creation Guide for Greek Snap

This guide explains how to create new cards and all the available options for abilities and effects.

## Basic Card Structure

Every card follows this template:

```python
{
    "id": 11,  # Unique ID (increment from existing cards)
    "name": "Card Name",
    "power": 4,  # Base power value
    "cost": 3,   # Base energy cost
    "ability": "Human-readable description of what the card does",
    "ability_type": "ongoing|on_reveal|none",
    "ability_effect": {
        "type": "effect_type",
        "value": 1,
        "target": "optional_target",
        "description": "What this effect does"
    }
}
```

## Ability Types

### `ability_type: "none"`
- **When**: No ability triggers
- **Use**: For simple cards with no special effects

### `ability_type: "on_reveal"`
- **When**: Triggers when the card is first played
- **Use**: One-time effects that happen immediately

### `ability_type: "ongoing"`
- **When**: Continuously active while the card is in play
- **Use**: Effects that modify power calculations or provide persistent bonuses


## Available Effect Types

### Card Effects

#### `"draw_cards"`
- **Purpose**: Draw additional cards
- **Parameters**: `value` (number of cards to draw)
- **Compatible with**: `on_reveal`

#### `"power_boost"`
- **Purpose**: Increase power of cards
- **Parameters**: 
  - `value` (power increase amount)
  - `target` (who gets the boost: `"other_cards"` or `"self"`)
- **Compatible with**: `ongoing`

#### `"reduce_opponent_power"`
- **Purpose**: Reduce opponent's card power
- **Parameters**: `value` (power reduction amount)
- **Compatible with**: `ongoing`

#### `"reduce_all_power"`
- **Purpose**: Reduce power of all cards at the location (both yours and opponent's)
- **Parameters**: `value` (power reduction amount)
- **Compatible with**: `ongoing`

#### `"destroy_card"`
- **Purpose**: Destroy cards from the location
- **Parameters**: 
  - `value` (number of cards to destroy)
  - `target` (which cards: `"own"` or `"opponent"`)
- **Compatible with**: `on_reveal`
- **Note**: The card that triggers the destroy effect will never destroy itself - it randomly selects other cards

## Power and Cost Guidelines


## Adding Cards to the Game

1. **Open `cards_data.py`**
2. **Add your card to the `CHARACTERS` list**
3. **Use the next available ID** (check existing cards for the highest ID)
4. **Follow the template structure** above
5. **Test your card** by running the game

## Effect Combinations

### Valid Combinations
- `on_reveal` + `draw_cards` ✅
- `on_reveal` + `destroy_card` ✅
- `ongoing` + `power_boost` ✅
- `ongoing` + `reduce_opponent_power` ✅
- `ongoing` + `reduce_all_power` ✅
- `none` + `None` ✅

### Invalid Combinations
- `on_reveal` + `power_boost` ❌ (Power boosts should be ongoing)
- `ongoing` + `draw_cards` ❌ (Draw effects should be on_reveal)

## Tips for Balanced Cards

1. **Strong abilities should have lower base power**
2. **High-cost cards should have significant impact**
3. **Draw effects are very powerful - use sparingly**
4. **Power reduction effects can be game-changing**
5. **Test cards against existing ones for balance**

## Future Effect Types

The system is designed to easily add new effect types. To add a new effect:

1. **Add to `EFFECT_REGISTRY` in `effect_system.py`**
2. **Implement the logic in `EffectHandler` class**
3. **Update this guide with the new effect type**

## Need Help?

- Check existing cards in `cards_data.py` for examples
- Look at `effect_system.py` for how effects are implemented
- Test your cards thoroughly before adding them to the main game 