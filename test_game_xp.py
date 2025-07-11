#!/usr/bin/env python3
"""
Test script for the game XP system
"""

from xp_system import XPSystem

def test_game_xp():
    print("Testing Game XP System...")
    print("=" * 50)
    
    # Test XP amounts for different game results
    print("XP Sources:")
    print(f"Game Win: {XPSystem.get_xp_source_amount('game_win')} XP")
    print(f"Game Loss: {XPSystem.get_xp_source_amount('game_loss')} XP")
    print(f"First Win of Day: {XPSystem.get_xp_source_amount('first_win_of_day')} XP")
    print(f"Card Played: {XPSystem.get_xp_source_amount('card_played')} XP")
    print(f"Location Captured: {XPSystem.get_xp_source_amount('location_captured')} XP")
    print(f"Perfect Game: {XPSystem.get_xp_source_amount('perfect_game')} XP")
    
    print("\n" + "=" * 50)
    print("Level Progression Examples:")
    
    # Test level progression with game wins
    xp = 0
    for game in range(1, 11):
        xp += XPSystem.get_xp_source_amount('game_win')
        level = XPSystem.get_level_from_xp(xp)
        xp_for_next = XPSystem.get_xp_for_next_level(xp)
        progress = XPSystem.get_progress_to_next_level(xp)
        
        print(f"Game {game:2d}: {xp:4d} XP | Level {level} | Next: {xp_for_next:4d} XP | Progress: {progress:5.1f}%")
    
    print("\n" + "=" * 50)
    print("Level Rewards:")
    
    # Show rewards for each level
    for level in range(1, 11):
        rewards = XPSystem.get_rewards_for_level(level)
        if rewards:
            print(f"Level {level:2d}: Card IDs {rewards}")
        else:
            print(f"Level {level:2d}: No rewards")

if __name__ == "__main__":
    test_game_xp() 