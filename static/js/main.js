// Marvel Snap Game JavaScript

class MarvelSnapGame {
    constructor() {
        this.selectedCard = null;
        this.draggedCardIndex = null;
        this.gameState = null;
        this.init();
    }

    init() {
        this.loadGameState();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // End turn button
        document.getElementById('endTurnBtn').addEventListener('click', () => {
            this.endTurn();
        });

        // New game button
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.newGame();
        });

        // Play again button in modal
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.newGame();
            const modal = bootstrap.Modal.getInstance(document.getElementById('gameOverModal'));
            modal.hide();
        });

        // Card detail modal close button
        document.getElementById('cardDetailModal').addEventListener('hidden.bs.modal', () => {
            // Reset modal content when closed
            this.resetModalContent();
        });
    }

    async loadGameState() {
        try {
            const response = await fetch('/api/game-state');
            this.gameState = await response.json();
            this.updateUI();
        } catch (error) {
            console.error('Error loading game state:', error);
        }
    }

    updateUI() {
        if (!this.gameState) return;

        // Update turn and energy display
        document.getElementById('turnDisplay').textContent = this.gameState.turn;
        document.getElementById('maxTurnDisplay').textContent = this.gameState.max_turns;
        document.getElementById('energyDisplay').textContent = this.gameState.player_energy;

        // Update locations
        this.updateLocations();

        // Update player hand
        this.updatePlayerHand();

        // Check for game over
        if (this.gameState.game_over) {
            this.showGameOver();
        }
    }

    updateLocations() {
        const container = document.getElementById('locationsContainer');
        container.innerHTML = '';

        this.gameState.locations.forEach((location, index) => {
            const locationElement = this.createLocationElement(location, index);
            container.appendChild(locationElement);
        });
    }

    createLocationElement(location, locationIndex) {
        const template = document.getElementById('locationTemplate');
        const locationElement = template.content.cloneNode(true);

        // Set location name and effect
        locationElement.querySelector('.location-name').textContent = location.name;
        locationElement.querySelector('.location-effect').textContent = location.effect;

        // Set location index on drop zones
        const opponentDropZone = locationElement.querySelector('.opponent-drop-zone');
        const playerDropZone = locationElement.querySelector('.player-drop-zone');
        opponentDropZone.setAttribute('data-location-index', locationIndex);
        playerDropZone.setAttribute('data-location-index', locationIndex);

        // Check if locations are full
        const opponentCardsCount = location.opponent_cards.length;
        const playerCardsCount = location.player_cards.length;
        const opponentIsFull = opponentCardsCount >= 4;
        const playerIsFull = playerCardsCount >= 4;

        // Add visual feedback for full locations
        if (opponentIsFull) {
            opponentDropZone.classList.add('location-full');
            opponentDropZone.title = 'Location full (4/4 cards)';
        }
        if (playerIsFull) {
            playerDropZone.classList.add('location-full');
            playerDropZone.title = 'Location full (4/4 cards)';
        }

        // Add power displays
        const opponentPower = location.opponent_power || 0;
        const playerPower = location.player_power || 0;
        
        // Create power display elements
        const opponentPowerDisplay = document.createElement('div');
        opponentPowerDisplay.className = 'power-display opponent-power';
        opponentPowerDisplay.textContent = opponentPower;
        opponentDropZone.appendChild(opponentPowerDisplay);
        
        const playerPowerDisplay = document.createElement('div');
        playerPowerDisplay.className = 'power-display player-power';
        playerPowerDisplay.textContent = playerPower;
        playerDropZone.appendChild(playerPowerDisplay);

        // Add opponent cards
        const opponentCardsContainer = locationElement.querySelector('.opponent-cards');
        location.opponent_cards.forEach((card, cardIndex) => {
            const cardElement = this.createCardElement(card, false);
            const cardDiv = cardElement.querySelector('.game-card');
            cardDiv.addEventListener('click', () => {
                this.showCardDetail(card, locationIndex, 'opponent', cardIndex);
            });
            opponentCardsContainer.appendChild(cardElement);
        });

        // Add player cards
        const playerCardsContainer = locationElement.querySelector('.player-cards');
        location.player_cards.forEach((card, cardIndex) => {
            const cardElement = this.createCardElement(card, false);
            const cardDiv = cardElement.querySelector('.game-card');
            cardDiv.addEventListener('click', () => {
                this.showCardDetail(card, locationIndex, 'player', cardIndex);
            });
            playerCardsContainer.appendChild(cardElement);
        });

        // Add drop zone functionality to player drop zone only (if not full)
        if (!playerIsFull) {
            playerDropZone.addEventListener('dragover', (e) => {
                this.handleDragOver(e);
            });
            playerDropZone.addEventListener('drop', (e) => {
                this.handleDrop(e, locationIndex);
            });
            playerDropZone.addEventListener('dragenter', (e) => {
                this.handleDragEnter(e);
            });
            playerDropZone.addEventListener('dragleave', (e) => {
                this.handleDragLeave(e);
            });
        }

        return locationElement;
    }

    updatePlayerHand() {
        const handContainer = document.getElementById('playerHand');
        handContainer.innerHTML = '';

        this.gameState.player_hand.forEach((card, index) => {
            const cardElement = this.createCardElement(card, true, index);
            handContainer.appendChild(cardElement);
        });
    }

    createCardElement(card, isHandCard = false, cardIndex = null) {
        const template = document.getElementById('cardTemplate');
        const cardElement = template.content.cloneNode(true);

        const cardDiv = cardElement.querySelector('.game-card');
        cardDiv.querySelector('.card-cost').textContent = card.cost;
        cardDiv.querySelector('.card-name').textContent = card.name;
        
        // Display power - show modified power if different from base power
        const powerElement = cardDiv.querySelector('.card-power');
        const powerToShow = card.modified_power !== undefined ? card.modified_power : card.power;
        
        powerElement.textContent = powerToShow;
        
        // Handle different power states
        powerElement.classList.remove('modified', 'negative');
        
        if (powerToShow < 0) {
            powerElement.classList.add('negative');
            powerElement.title = `Base: ${card.power}, Modified: ${powerToShow}`;
        } else if (card.modified_power !== undefined && card.modified_power !== card.power) {
            powerElement.classList.add('modified');
            powerElement.title = `Base: ${card.power}, Modified: ${powerToShow}`;
        }
        
        cardDiv.querySelector('.card-ability').textContent = card.ability;

        if (isHandCard && cardIndex !== null) {
            cardDiv.setAttribute('data-card-index', cardIndex);
            
            // Check if card is playable
            if (card.cost > this.gameState.player_energy) {
                cardDiv.style.opacity = '0.5';
                cardDiv.style.cursor = 'not-allowed';
            } else {
                // Make card draggable
                cardDiv.draggable = true;
                cardDiv.addEventListener('dragstart', (e) => {
                    this.handleDragStart(e, cardIndex);
                });
                cardDiv.addEventListener('dragend', (e) => {
                    this.handleDragEnd(e);
                });
                
                // Keep click functionality as fallback
                cardDiv.addEventListener('click', () => {
                    this.selectCard(cardIndex);
                });
            }
        }

        return cardElement;
    }

    selectCard(cardIndex) {
        // Remove previous selection
        document.querySelectorAll('.game-card.selected').forEach(card => {
            card.classList.remove('selected');
        });

        // Select new card
        const cardElement = document.querySelector(`[data-card-index="${cardIndex}"]`);
        if (cardElement) {
            cardElement.classList.add('selected');
            this.selectedCard = cardIndex;
        }
    }

    // Drag and Drop Methods
    handleDragStart(e, cardIndex) {
        e.dataTransfer.setData('text/plain', cardIndex);
        e.dataTransfer.effectAllowed = 'move';
        this.draggedCardIndex = cardIndex;
        
        // Add visual feedback
        e.target.style.opacity = '0.5';
        e.target.style.transform = 'rotate(5deg)';
    }

    handleDragEnd(e) {
        // Remove visual feedback
        e.target.style.opacity = '1';
        e.target.style.transform = 'rotate(0deg)';
        this.draggedCardIndex = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e, locationIndex) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const cardIndex = this.draggedCardIndex;
        if (cardIndex !== null) {
            this.playCardToLocation(locationIndex, cardIndex);
        }
    }

    async playCardToLocation(locationIndex, cardIndex = null) {
        const cardToPlay = cardIndex !== null ? cardIndex : this.selectedCard;
        if (cardToPlay === null) {
            alert('Please select a card first!');
            return;
        }

        try {
            const response = await fetch('/api/play-card', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    card_index: cardToPlay,
                    location_index: locationIndex
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.gameState = result.game_state;
                this.selectedCard = null;
                this.draggedCardIndex = null;
                this.updateUI();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error playing card:', error);
            alert('Error playing card. Please try again.');
        }
    }

    async endTurn() {
        try {
            const response = await fetch('/api/end-turn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (result.success) {
                this.gameState = result.game_state;
                this.selectedCard = null;
                this.updateUI();
            }
        } catch (error) {
            console.error('Error ending turn:', error);
            alert('Error ending turn. Please try again.');
        }
    }

    async newGame() {
        try {
            const response = await fetch('/api/new-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();
            
            if (result.success) {
                this.gameState = result.game_state;
                this.selectedCard = null;
                this.updateUI();
            }
        } catch (error) {
            console.error('Error starting new game:', error);
            alert('Error starting new game. Please try again.');
        }
    }

    showGameOver() {
        const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
        const resultDiv = document.getElementById('gameResult');
        
        let resultText = '';
        if (this.gameState.winner === 'player') {
            resultText = '<h4 class="text-success">🎉 You Won! 🎉</h4>';
        } else if (this.gameState.winner === 'opponent') {
            resultText = '<h4 class="text-danger">😔 You Lost 😔</h4>';
        } else {
            resultText = '<h4 class="text-warning">🤝 It\'s a Tie! 🤝</h4>';
        }
        
        resultText += '<p class="mt-3">Final Score:</p>';
        this.gameState.locations.forEach((location, index) => {
            const playerPower = location.player_cards.reduce((sum, card) => sum + card.power, 0);
            const opponentPower = location.opponent_cards.reduce((sum, card) => sum + card.power, 0);
            resultText += `<p>${location.name}: ${playerPower} vs ${opponentPower}</p>`;
        });
        
        resultDiv.innerHTML = resultText;
        modal.show();
    }

    showCardDetail(card, locationIndex, player, cardIndex) {
        // Populate modal with card information
        document.getElementById('modalCardName').textContent = card.name;
        document.getElementById('modalCardCost').textContent = card.cost;
        
        // Show modified power if different from base power
        const powerToShow = card.modified_power !== undefined ? card.modified_power : card.power;
        document.getElementById('modalCardPower').textContent = powerToShow;
        
        document.getElementById('modalCardAbility').textContent = card.ability;

        // Generate power breakdown
        this.generatePowerBreakdown(card, locationIndex, player);

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('cardDetailModal'));
        modal.show();
    }

    generatePowerBreakdown(card, locationIndex, player) {
        const breakdownContainer = document.getElementById('modalPowerBreakdown');
        breakdownContainer.innerHTML = '';

        const basePower = card.power;
        const modifiedPower = card.modified_power !== undefined ? card.modified_power : card.power;
        
        // Base power
        const baseItem = document.createElement('div');
        baseItem.className = 'power-breakdown-item neutral';
        baseItem.innerHTML = `<span>Base Power:</span><span>${basePower}</span>`;
        breakdownContainer.appendChild(baseItem);

        // Power boosts from ongoing abilities
        const location = this.gameState.locations[locationIndex];
        const cards = player === 'player' ? location.player_cards : location.opponent_cards;
        
        let totalBoost = 0;
        const boostSources = [];
        cards.forEach(otherCard => {
            if (otherCard !== card && 
                otherCard.ability_type === 'ongoing' && 
                otherCard.ability_effect && 
                otherCard.ability_effect.type === 'power_boost' &&
                otherCard.ability_effect.target === 'other_cards') {
                totalBoost += otherCard.ability_effect.value;
                boostSources.push(`${otherCard.name} (+${otherCard.ability_effect.value})`);
            }
        });

        if (totalBoost > 0) {
            const boostItem = document.createElement('div');
            boostItem.className = 'power-breakdown-item positive';
            boostItem.innerHTML = `<span>Power Boosts:</span><span>+${totalBoost}</span>`;
            breakdownContainer.appendChild(boostItem);
            
            // Add individual boost sources
            boostSources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'power-breakdown-item positive';
                sourceItem.style.marginLeft = '1rem';
                sourceItem.style.fontSize = '0.9em';
                sourceItem.innerHTML = `<span>• ${source}</span>`;
                breakdownContainer.appendChild(sourceItem);
            });
        }

        // Power reductions from opponent's ongoing abilities
        const opponentCards = player === 'player' ? location.opponent_cards : location.player_cards;
        
        let totalReduction = 0;
        const reductionSources = [];
        opponentCards.forEach(opponentCard => {
            if (opponentCard.ability_type === 'ongoing' && 
                opponentCard.ability_effect && 
                opponentCard.ability_effect.type === 'reduce_opponent_power') {
                totalReduction += opponentCard.ability_effect.value;
                reductionSources.push(`${opponentCard.name} (-${opponentCard.ability_effect.value})`);
            }
        });

        if (totalReduction > 0) {
            const reductionItem = document.createElement('div');
            reductionItem.className = 'power-breakdown-item negative';
            reductionItem.innerHTML = `<span>Power Reductions:</span><span>-${totalReduction}</span>`;
            breakdownContainer.appendChild(reductionItem);
            
            // Add individual reduction sources
            reductionSources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'power-breakdown-item negative';
                sourceItem.style.marginLeft = '1rem';
                sourceItem.style.fontSize = '0.9em';
                sourceItem.innerHTML = `<span>• ${source}</span>`;
                breakdownContainer.appendChild(sourceItem);
            });
        }

        // Total modified power
        if (modifiedPower !== basePower) {
            const totalItem = document.createElement('div');
            totalItem.className = 'power-breakdown-item neutral';
            totalItem.style.fontWeight = 'bold';
            totalItem.style.borderTop = '1px solid #dee2e6';
            totalItem.style.paddingTop = '0.5rem';
            totalItem.style.marginTop = '0.5rem';
            totalItem.innerHTML = `<span>Total Power:</span><span>${modifiedPower}</span>`;
            breakdownContainer.appendChild(totalItem);
        }
    }

    resetModalContent() {
        // Reset modal content when closed
        document.getElementById('modalCardName').textContent = '';
        document.getElementById('modalCardCost').textContent = '';
        document.getElementById('modalCardPower').textContent = '';
        document.getElementById('modalCardAbility').textContent = '';
        document.getElementById('modalPowerBreakdown').innerHTML = '';
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MarvelSnapGame();
});
