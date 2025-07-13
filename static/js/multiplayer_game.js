// Multiplayer Greek Snap Game JavaScript

class MultiplayerGame {
    constructor() {
        this.selectedCard = null;
        this.draggedCardIndex = null;
        this.gameState = null;
        this.socket = null;
        this.myPlayerId = null;
        this.gameId = null;
        this.init();
    }

    init() {
        this.setupSocket();
        this.setupEventListeners();
        this.showWaitingIndicator();
    }

    setupSocket() {
        // Connect to Socket.IO
        this.socket = io();
        
        // Socket event listeners
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.joinPlayerRoom();
        });
        
        this.socket.on('game_found', (data) => {
            console.log('Game found:', data);
            this.gameId = data.game_id;
            this.hideWaitingIndicator();
            console.log('Requesting game state after game found');
            this.requestGameState();
        });
        
        this.socket.on('game_state_update', (gameState) => {
            console.log('Game state update received:', gameState);
            this.gameState = gameState;
            this.hideWaitingIndicator(); // Hide waiting indicator when we get game state
            this.updateUI();
        });
        
        this.socket.on('game_over', (data) => {
            console.log('Game over:', data);
            this.showGameOver(data);
        });
        
        this.socket.on('game_error', (data) => {
            console.error('Game error:', data);
            this.showError(data.message);
        });
        
        this.socket.on('card_played', (data) => {
            console.log('Card played:', data);
            this.showNotification(data.message, 'success');
        });
        
        this.socket.on('turn_ended', (data) => {
            console.log('Turn ended:', data);
            this.showNotification(data.message, 'info');
        });
    }

    setupEventListeners() {
        // End turn button
        document.getElementById('endTurnBtn').addEventListener('click', () => {
            this.endTurn();
        });

        // Play again button in modal
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.playAgain();
            const modal = bootstrap.Modal.getInstance(document.getElementById('gameOverModal'));
            modal.hide();
        });

        // Back to menu button in modal
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            window.location.href = '/';
        });

        // Card detail modal close button
        document.getElementById('cardDetailModal').addEventListener('hidden.bs.modal', () => {
            this.resetModalContent();
        });
    }

    joinPlayerRoom() {
        // Join a room for this player (will be set up by the server)
        this.socket.emit('join_player_room');
    }

    requestGameState() {
        console.log('Requesting game state from server');
        this.socket.emit('get_game_state', {});
    }

    showWaitingIndicator() {
        document.getElementById('waitingIndicator').style.display = 'block';
    }

    hideWaitingIndicator() {
        console.log('Hiding waiting indicator');
        const waitingIndicator = document.getElementById('waitingIndicator');
        if (waitingIndicator) {
            waitingIndicator.style.display = 'none';
            console.log('Waiting indicator hidden successfully');
        } else {
            console.error('Waiting indicator element not found');
        }
    }

    updateUI() {
        if (!this.gameState) {
            console.log('No game state available for UI update');
            return;
        }

        console.log('Updating UI with game state:', this.gameState);
        console.log('Is my turn:', this.gameState.is_my_turn);

        // Update turn indicator
        this.updateTurnIndicator();

        // Update turn and energy display
        document.getElementById('turnDisplay').textContent = this.gameState.turn;
        document.getElementById('maxTurnDisplay').textContent = this.gameState.max_turns;
        document.getElementById('energyDisplay').textContent = this.gameState.player_energy;

        // Update locations
        this.updateLocations();

        // Update player hand
        this.updatePlayerHand();

        // Update controls based on turn
        this.updateControls();

        // Check for game over
        if (this.gameState.game_over) {
            this.showGameOver({ winner: this.gameState.winner });
        }
    }

    updateTurnIndicator() {
        const turnIndicator = document.getElementById('turnIndicator');
        const turnText = document.getElementById('turnText');
        
        console.log('Updating turn indicator. Is my turn:', this.gameState.is_my_turn);
        
        if (this.gameState.is_my_turn) {
            turnIndicator.className = 'turn-indicator your-turn';
            turnText.innerHTML = '<i class="fas fa-play me-2"></i>Your Turn!';
            console.log('Set turn indicator to: Your Turn!');
        } else {
            turnIndicator.className = 'turn-indicator not-your-turn';
            turnText.innerHTML = '<i class="fas fa-clock me-2"></i>Opponent\'s Turn';
            console.log('Set turn indicator to: Opponent\'s Turn');
        }
    }

    updateControls() {
        const handAndControls = document.getElementById('handAndControls');
        const endTurnBtn = document.getElementById('endTurnBtn');
        
        if (this.gameState.is_my_turn) {
            handAndControls.classList.remove('disabled-controls');
            endTurnBtn.disabled = false;
        } else {
            handAndControls.classList.add('disabled-controls');
            endTurnBtn.disabled = true;
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

        // Set background image if available
        const backgroundElement = locationElement.querySelector('.location-background');
        if (location.background_image) {
            backgroundElement.style.backgroundImage = `url('${location.background_image}')`;
        }

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
            const cardElement = this.createCardElement(card, false, cardIndex, locationIndex);
            const cardDiv = cardElement.querySelector('.game-card');
            cardDiv.addEventListener('click', () => {
                this.showCardDetail(card, locationIndex, 'opponent', cardIndex);
            });
            opponentCardsContainer.appendChild(cardElement);
        });

        // Add player cards
        const playerCardsContainer = locationElement.querySelector('.player-cards');
        location.player_cards.forEach((card, cardIndex) => {
            const cardElement = this.createCardElement(card, false, cardIndex, locationIndex);
            const cardDiv = cardElement.querySelector('.game-card');
            cardDiv.addEventListener('click', () => {
                this.showCardDetail(card, locationIndex, 'player', cardIndex);
            });
            playerCardsContainer.appendChild(cardElement);
        });

        // Add drop zone functionality to player drop zone only (if not full and it's your turn)
        if (!playerIsFull && this.gameState.is_my_turn) {
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

    createCardElement(card, isHandCard = false, cardIndex = null, locationIndex = null) {
        const template = document.getElementById('cardTemplate');
        const cardElement = template.content.cloneNode(true);

        const cardDiv = cardElement.querySelector('.game-card');
        
        // Handle cost display
        const costElement = cardDiv.querySelector('.card-cost');
        let actualCost = card.cost;
        let baseCost = card.cost;
        
        // Calculate global cost reduction from all locations
        let globalCostReduction = 0;
        this.gameState.locations.forEach(location => {
            if (location.effect_type === 'cost_reduction') {
                globalCostReduction += location.effect_value;
            }
        });
        
        // Apply hand cost increases
        actualCost += this.gameState.player_hand_cost_increase;
        
        // Apply global cost reduction
        actualCost = Math.max(0, actualCost - globalCostReduction);
        
        // Show cost with color coding
        costElement.textContent = actualCost;
        if (actualCost < baseCost) {
            costElement.style.color = 'green';
        } else if (actualCost > baseCost) {
            costElement.style.color = 'red';
        } else {
            costElement.style.color = 'white';
        }
        
        // Set card name and power
        cardDiv.querySelector('.card-name').textContent = card.name;
        cardDiv.querySelector('.card-power').textContent = card.power;
        
        // Set card ability
        const abilityElement = cardDiv.querySelector('.card-ability');
        if (card.ability) {
            abilityElement.textContent = card.ability;
        } else {
            abilityElement.textContent = '';
        }
        
        // Set card image
        const imageElement = cardDiv.querySelector('.card-image');
        if (card.image) {
            imageElement.style.backgroundImage = `url('${card.image}')`;
        }
        
        // Set card index for drag and drop
        if (cardIndex !== null) {
            cardDiv.setAttribute('data-card-index', cardIndex);
        }
        
        // Add drag functionality for hand cards
        if (isHandCard && this.gameState.is_my_turn) {
            cardDiv.draggable = true;
            cardDiv.addEventListener('dragstart', (e) => {
                this.handleDragStart(e, cardIndex);
            });
            cardDiv.addEventListener('dragend', (e) => {
                this.handleDragEnd(e);
            });
            cardDiv.addEventListener('click', () => {
                this.selectCard(cardIndex);
            });
        }
        
        return cardElement;
    }

    selectCard(cardIndex) {
        // Remove previous selection
        document.querySelectorAll('.game-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Select new card
        this.selectedCard = cardIndex;
        const cardElement = document.querySelector(`[data-card-index="${cardIndex}"]`);
        if (cardElement) {
            cardElement.classList.add('selected');
        }
    }

    handleDragStart(e, cardIndex) {
        this.draggedCardIndex = cardIndex;
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.5';
    }

    handleDragEnd(e) {
        this.draggedCardIndex = null;
        e.target.style.opacity = '1';
        
        // Remove drag-over styling
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.target.closest('.drop-zone').classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.target.closest('.drop-zone').classList.remove('drag-over');
    }

    handleDrop(e, locationIndex) {
        e.preventDefault();
        e.target.closest('.drop-zone').classList.remove('drag-over');
        
        if (this.draggedCardIndex !== null) {
            this.playCardToLocation(locationIndex, this.draggedCardIndex);
        }
    }

    async playCardToLocation(locationIndex, cardIndex = null) {
        if (!this.gameState.is_my_turn) {
            this.showError("Not your turn!");
            return;
        }
        
        if (cardIndex === null) {
            cardIndex = this.selectedCard;
        }
        
        if (cardIndex === null) {
            this.showError("Please select a card first");
            return;
        }
        
        // Send play card request via socket
        this.socket.emit('play_card', {
            card_index: cardIndex,
            location_index: locationIndex
        });
    }

    async endTurn() {
        if (!this.gameState.is_my_turn) {
            this.showError("Not your turn!");
            return;
        }
        
        // Send end turn request via socket
        this.socket.emit('end_turn', {});
    }

    async playAgain() {
        // Redirect to matchmaking
        window.location.href = '/';
    }

    async showGameOver(data) {
        const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
        const gameResult = document.getElementById('gameResult');
        
        let resultText = '';
        if (data.winner === 'player') {
            resultText = '<h4 class="text-success"><i class="fas fa-trophy me-2"></i>You Won!</h4>';
        } else if (data.winner === 'opponent') {
            resultText = '<h4 class="text-danger"><i class="fas fa-times me-2"></i>You Lost!</h4>';
        } else {
            resultText = '<h4 class="text-warning"><i class="fas fa-handshake me-2"></i>It\'s a Tie!</h4>';
        }
        
        gameResult.innerHTML = resultText;
        modal.show();
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} position-fixed`;
        notification.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showCardDetail(card, locationIndex, player, cardIndex) {
        const modal = new bootstrap.Modal(document.getElementById('cardDetailModal'));
        
        // Set card details
        document.getElementById('modalCardName').textContent = card.name;
        document.getElementById('modalCardCost').textContent = card.cost;
        document.getElementById('modalCardPower').textContent = card.power;
        document.getElementById('modalCardAbility').textContent = card.ability || 'No special ability';
        
        // Generate power breakdown
        const powerBreakdown = this.generatePowerBreakdown(card, locationIndex, player);
        document.getElementById('modalPowerBreakdown').innerHTML = powerBreakdown;
        
        modal.show();
    }

    generatePowerBreakdown(card, locationIndex, player) {
        if (!this.gameState) return '';
        
        const location = this.gameState.locations[locationIndex];
        const basePower = card.power;
        let breakdown = `<div class="mb-2"><strong>Base Power:</strong> ${basePower}</div>`;
        
        // Add location effects
        if (location.effect_type === 'power_boost') {
            breakdown += `<div class="mb-2"><strong>Location Bonus:</strong> +${location.effect_value}</div>`;
        }
        
        // Add card ability effects
        if (card.ability_type === 'ongoing') {
            breakdown += `<div class="mb-2"><strong>Ongoing Effect:</strong> ${card.ability}</div>`;
        }
        
        return breakdown;
    }

    resetModalContent() {
        document.getElementById('modalCardName').textContent = '';
        document.getElementById('modalCardCost').textContent = '';
        document.getElementById('modalCardPower').textContent = '';
        document.getElementById('modalCardAbility').textContent = '';
        document.getElementById('modalPowerBreakdown').innerHTML = '';
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiplayerGame();
}); 