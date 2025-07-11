# XP System Configuration
# This file makes it super easy to configure levels and rewards

# XP required for each level (level 1 starts at 0 XP)
LEVEL_XP_REQUIREMENTS = {
    1: 0,      # Starting level
    2: 100,    # 100 XP to reach level 2
    3: 250,    # 150 more XP to reach level 3
    4: 450,    # 200 more XP to reach level 4
    5: 700,    # 250 more XP to reach level 5
    6: 1000,   # 300 more XP to reach level 6
    7: 1350,   # 350 more XP to reach level 7
    8: 1750,   # 400 more XP to reach level 8
    9: 2200,   # 450 more XP to reach level 9
    10: 2700,  # 500 more XP to reach level 10
    # Add more levels here as needed:
    # 11: 3250,
    # 12: 3850,
    # etc.
}

# Rewards for each level (card IDs to unlock)
LEVEL_REWARDS = {
    1: [],           # Level 1 - no reward (starting level)
    2: [1],          # Level 2 - unlock Zeus card (ID: 1)
    3: [4],          # Level 3 - unlock Athena card (ID: 4)
    4: [2],          # Level 4 - unlock Poseidon card (ID: 2)
    5: [7],          # Level 5 - unlock Ares card (ID: 7)
    6: [5],          # Level 6 - unlock Apollo card (ID: 5)
    7: [6],          # Level 7 - unlock Artemis card (ID: 6)
    8: [10],         # Level 8 - unlock Hermes card (ID: 10)
    9: [11],         # Level 9 - unlock Dionysus card (ID: 11)
    10: [3],         # Level 10 - unlock Hades card (ID: 3)
    # Add more rewards here as needed:
    # 11: [8],        # Hephaestus (ID: 8)
    # 12: [9],        # Aphrodite (ID: 9)
    # 13: [12],       # Hera (ID: 12)
    # etc.
}

# XP sources and amounts
XP_SOURCES = {
    "game_win": 100,      # XP for winning a game
    "game_loss": 100,     # XP for losing a game (participation)
    "first_win_of_day": 25,  # Bonus XP for first win of the day
    "card_played": 0,    # XP for playing a card
    "location_captured": 0, # XP for capturing a location
    "perfect_game": 0, # XP for winning without losing any locations
}

class XPSystem:
    @staticmethod
    def get_level_from_xp(xp):
        """Get current level based on XP"""
        current_level = 1
        for level, required_xp in LEVEL_XP_REQUIREMENTS.items():
            if xp >= required_xp:
                current_level = level
            else:
                break
        return current_level
    
    @staticmethod
    def get_xp_for_next_level(current_xp):
        """Get XP needed for next level"""
        current_level = XPSystem.get_level_from_xp(current_xp)
        next_level = current_level + 1
        
        if next_level in LEVEL_XP_REQUIREMENTS:
            return LEVEL_XP_REQUIREMENTS[next_level] - current_xp
        else:
            return 0  # Max level reached
    
    @staticmethod
    def get_progress_to_next_level(current_xp):
        """Get progress percentage to next level (0-100)"""
        current_level = XPSystem.get_level_from_xp(current_xp)
        next_level = current_level + 1
        
        if next_level not in LEVEL_XP_REQUIREMENTS:
            return 100  # Max level reached
        
        current_level_xp = LEVEL_XP_REQUIREMENTS[current_level]
        next_level_xp = LEVEL_XP_REQUIREMENTS[next_level]
        xp_in_current_level = current_xp - current_level_xp
        xp_needed_for_next = next_level_xp - current_level_xp
        
        return min(100, (xp_in_current_level / xp_needed_for_next) * 100)
    
    @staticmethod
    def get_rewards_for_level(level):
        """Get rewards for a specific level"""
        return LEVEL_REWARDS.get(level, [])
    
    @staticmethod
    def get_pending_rewards(user_xp, unlocked_cards):
        """Get rewards that should be given to user but haven't been yet"""
        current_level = XPSystem.get_level_from_xp(user_xp)
        pending_rewards = []
        
        for level in range(1, current_level + 1):
            level_rewards = LEVEL_REWARDS.get(level, [])
            for card_id in level_rewards:
                if card_id not in unlocked_cards:
                    pending_rewards.append({
                        'level': level,
                        'card_id': card_id
                    })
        
        return pending_rewards
    
    @staticmethod
    def get_xp_source_amount(source):
        """Get XP amount for a specific source"""
        return XP_SOURCES.get(source, 0) 