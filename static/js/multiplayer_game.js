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
            // Reset modal content when closed
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
        console.log('Turn state:', {
            player1_ready: this.gameState.player1_ready,
            player2_ready: this.gameState.player2_ready,
            both_players_ready: this.gameState.both_players_ready
        });
        
        if (this.gameState.is_my_turn) {
            turnIndicator.className = 'turn-indicator your-turn';
            turnText.innerHTML = '<i class="fas fa-play me-2"></i>Your Turn!';
            console.log('Set turn indicator to: Your Turn!');
        } else {
            // Check if this player has already ended their turn
            const myPlayerId = this.gameState.my_player_id;
            const iHaveEndedTurn = (myPlayerId === 'player1' && this.gameState.player1_ready) || 
                                  (myPlayerId === 'player2' && this.gameState.player2_ready);
            
            if (iHaveEndedTurn) {
                turnIndicator.className = 'turn-indicator waiting-for-opponent';
                turnText.innerHTML = '<i class="fas fa-hourglass-half me-2"></i>Waiting for Opponent...';
                console.log('Set turn indicator to: Waiting for Opponent...');
            } else {
                turnIndicator.className = 'turn-indicator not-your-turn';
                turnText.innerHTML = '<i class="fas fa-clock me-2"></i>Opponent\'s Turn';
                console.log('Set turn indicator to: Opponent\'s Turn');
            }
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
        
        if (isHandCard && locationIndex !== null && card.location_costs && card.location_costs[locationIndex] !== undefined) {
            // Use location-specific cost for hand cards
            actualCost = card.location_costs[locationIndex];
        } else {
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
        }
        
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
        
        // Handle power display - show modified power if different from base
        const powerElement = cardDiv.querySelector('.card-power');
        const basePower = card.power;
        const modifiedPower = card.modified_power !== undefined ? card.modified_power : card.power;
        
        powerElement.textContent = modifiedPower;
        
        // Color code power if modified
        if (modifiedPower > basePower) {
            powerElement.classList.add('modified');
        } else if (modifiedPower < basePower) {
            powerElement.classList.add('negative');
        } else {
            powerElement.classList.remove('modified', 'negative');
        }
        
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
        
        // Add XP information if available
        if (data.xp_info) {
            const xpInfo = data.xp_info;
            resultText += `
                <div class="mt-3">
                    <div class="alert alert-info">
                        <i class="fas fa-star me-2"></i>
                        <strong>+${xpInfo.xp_awarded} XP!</strong>
                        <br>
                        Total XP: ${xpInfo.new_total_xp}
                        ${xpInfo.leveled_up ? '<br><span class="text-success"><i class="fas fa-level-up-alt me-1"></i>Level Up! You are now level ' + xpInfo.new_level + '</span>' : ''}
                    </div>
                    <div class="progress mb-2">
                        <div class="progress-bar" role="progressbar" style="width: ${xpInfo.progress}%" 
                             aria-valuenow="${xpInfo.progress}" aria-valuemin="0" aria-valuemax="100">
                            ${xpInfo.progress.toFixed(1)}%
                        </div>
                    </div>
                    <small class="text-muted">${xpInfo.xp_for_next} XP to next level</small>
                </div>
            `;
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
        // Populate modal with card information
        document.getElementById('modalCardName').textContent = card.name;
        document.getElementById('modalCardCost').textContent = card.cost;
        
        // Show base power in the modal's power circle (always blue)
        const powerElement = document.getElementById('modalCardPower');
        powerElement.textContent = card.power;
        powerElement.style.backgroundColor = '#3498db'; // Blue for base power
        
        document.getElementById('modalCardAbility').textContent = card.ability || 'No special ability';

        // Generate cost breakdown (only for cards on board, not hand cards)
        if (locationIndex !== null) {
            this.generateCostBreakdown(card, locationIndex, player);
        } else {
            // For hand cards, show simple cost info
            const powerBreakdownContainer = document.getElementById('modalPowerBreakdown');
            const costBreakdownDiv = document.createElement('div');
            costBreakdownDiv.className = 'card-detail-cost-breakdown';
            costBreakdownDiv.innerHTML = '<h6>Cost:</h6><div id="modalCostBreakdown"></div>';
            powerBreakdownContainer.parentNode.insertBefore(costBreakdownDiv, powerBreakdownContainer);
            
            const costBreakdownContainer = document.getElementById('modalCostBreakdown');
            costBreakdownContainer.innerHTML = '';
            
            const baseCost = card.cost;
            
            // Calculate global cost reduction from all locations
            let globalCostReduction = 0;
            const costReductionSources = [];
            this.gameState.locations.forEach((location, index) => {
                if (location.effect_type === 'cost_reduction') {
                    globalCostReduction += location.effect_value;
                    costReductionSources.push(`${location.name} (-${location.effect_value})`);
                }
            });
            
            // Apply hand cost increases from Ares or other effects
            const handCostIncrease = this.gameState.player_hand_cost_increase || 0;
            
            const actualCost = Math.max(0, baseCost + handCostIncrease - globalCostReduction);
            
            // Base cost
            const baseItem = document.createElement('div');
            baseItem.className = 'cost-breakdown-item neutral';
            baseItem.innerHTML = `<span>Base Cost:</span><span>${baseCost}</span>`;
            costBreakdownContainer.appendChild(baseItem);

            // Hand cost increases
            if (handCostIncrease > 0) {
                const increaseItem = document.createElement('div');
                increaseItem.className = 'cost-breakdown-item negative';
                increaseItem.innerHTML = `<span>Hand Cost Increases:</span><span>+${handCostIncrease}</span>`;
                costBreakdownContainer.appendChild(increaseItem);

                // Show source
                const sourceItem = document.createElement('div');
                sourceItem.className = 'cost-breakdown-item negative';
                sourceItem.style.marginLeft = '1rem';
                sourceItem.style.fontSize = '0.9em';
                sourceItem.innerHTML = `<span>• Ares (+${handCostIncrease})</span>`;
                costBreakdownContainer.appendChild(sourceItem);
            }

            // Cost reductions from locations
            if (globalCostReduction > 0) {
                const reductionItem = document.createElement('div');
                reductionItem.className = 'cost-breakdown-item positive';
                reductionItem.innerHTML = `<span>Cost Reductions:</span><span>-${globalCostReduction}</span>`;
                costBreakdownContainer.appendChild(reductionItem);
                
                // Add individual reduction sources
                costReductionSources.forEach(source => {
                    const sourceItem = document.createElement('div');
                    sourceItem.className = 'cost-breakdown-item positive';
                    sourceItem.style.marginLeft = '1rem';
                    sourceItem.style.fontSize = '0.9em';
                    sourceItem.innerHTML = `<span>• ${source}</span>`;
                    costBreakdownContainer.appendChild(sourceItem);
                });
                
                // Total modified cost
                const totalItem = document.createElement('div');
                totalItem.className = 'cost-breakdown-item neutral';
                totalItem.style.fontWeight = 'bold';
                totalItem.style.borderTop = '1px solid #dee2e6';
                totalItem.style.paddingTop = '0.5rem';
                totalItem.style.marginTop = '0.5rem';
                totalItem.innerHTML = `<span>Total Cost:</span><span>${actualCost}</span>`;
                costBreakdownContainer.appendChild(totalItem);
            } else if (handCostIncrease > 0) {
                // Show total when there are hand cost increases but no reductions
                const totalItem = document.createElement('div');
                totalItem.className = 'cost-breakdown-item neutral';
                totalItem.style.fontWeight = 'bold';
                totalItem.style.borderTop = '1px solid #dee2e6';
                totalItem.style.paddingTop = '0.5rem';
                totalItem.style.marginTop = '0.5rem';
                totalItem.innerHTML = `<span>Total Cost:</span><span>${actualCost}</span>`;
                costBreakdownContainer.appendChild(totalItem);
            }
        }

        // Generate power breakdown (only for cards on board, not hand cards)
        if (locationIndex !== null) {
            this.generatePowerBreakdown(card, locationIndex, player);
        } else {
            // For hand cards, show simple power info
            const breakdownContainer = document.getElementById('modalPowerBreakdown');
            breakdownContainer.innerHTML = '';
            
            const basePower = card.power;
            
            // Base power
            const baseItem = document.createElement('div');
            baseItem.className = 'power-breakdown-item neutral';
            baseItem.innerHTML = `<span>Base Power:</span><span>${basePower}</span>`;
            breakdownContainer.appendChild(baseItem);
        }

        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('cardDetailModal'));
        modal.show();
    }

    generateCostBreakdown(card, locationIndex, player) {
        const breakdownContainer = document.getElementById('modalCostBreakdown');
        if (!breakdownContainer) {
            // Create cost breakdown container if it doesn't exist
            const powerBreakdownContainer = document.getElementById('modalPowerBreakdown');
            const costBreakdownDiv = document.createElement('div');
            costBreakdownDiv.className = 'card-detail-cost-breakdown';
            costBreakdownDiv.innerHTML = '<h6>Cost Breakdown:</h6><div id="modalCostBreakdown"></div>';
            powerBreakdownContainer.parentNode.insertBefore(costBreakdownDiv, powerBreakdownContainer);
        }
        
        const costBreakdownContainer = document.getElementById('modalCostBreakdown');
        costBreakdownContainer.innerHTML = '';

        const baseCost = card.cost;
        
        // Calculate global cost reduction from all locations
        let globalCostReduction = 0;
        const costReductionSources = [];
        this.gameState.locations.forEach((location, index) => {
            if (location.effect_type === 'cost_reduction') {
                globalCostReduction += location.effect_value;
                costReductionSources.push(`${location.name} (-${location.effect_value})`);
            }
        });
        
        // Get hand cost increase from game state
        const handCostIncrease = this.gameState.player_hand_cost_increase || 0;
        
        const actualCost = Math.max(0, baseCost + handCostIncrease - globalCostReduction);
        
        // Base cost
        const baseItem = document.createElement('div');
        baseItem.className = 'cost-breakdown-item neutral';
        baseItem.innerHTML = `<span>Base Cost:</span><span>${baseCost}</span>`;
        costBreakdownContainer.appendChild(baseItem);

        // Hand cost increases
        if (handCostIncrease > 0) {
            const increaseItem = document.createElement('div');
            increaseItem.className = 'cost-breakdown-item negative';
            increaseItem.innerHTML = `<span>Hand Cost Increases:</span><span>+${handCostIncrease}</span>`;
            costBreakdownContainer.appendChild(increaseItem);

            // Show source
            const sourceItem = document.createElement('div');
            sourceItem.className = 'cost-breakdown-item negative';
            sourceItem.style.marginLeft = '1rem';
            sourceItem.style.fontSize = '0.9em';
            sourceItem.innerHTML = `<span>• Ares (+${handCostIncrease})</span>`;
            costBreakdownContainer.appendChild(sourceItem);
        }

        // Cost reductions from locations
        if (globalCostReduction > 0) {
            const reductionItem = document.createElement('div');
            reductionItem.className = 'cost-breakdown-item positive';
            reductionItem.innerHTML = `<span>Cost Reductions:</span><span>-${globalCostReduction}</span>`;
            costBreakdownContainer.appendChild(reductionItem);
            
            // Add individual reduction sources
            costReductionSources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'cost-breakdown-item positive';
                sourceItem.style.marginLeft = '1rem';
                sourceItem.style.fontSize = '0.9em';
                sourceItem.innerHTML = `<span>• ${source}</span>`;
                costBreakdownContainer.appendChild(sourceItem);
            });
        }

        // Total modified cost
        if (actualCost !== baseCost) {
            const totalItem = document.createElement('div');
            totalItem.className = 'cost-breakdown-item neutral';
            totalItem.style.fontWeight = 'bold';
            totalItem.style.borderTop = '1px solid #dee2e6';
            totalItem.style.paddingTop = '0.5rem';
            totalItem.style.marginTop = '0.5rem';
            totalItem.innerHTML = `<span>Total Cost:</span><span>${actualCost}</span>`;
            costBreakdownContainer.appendChild(totalItem);
        }
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

        // Location effect (use unique variable names)
        const loc = this.gameState.locations[locationIndex];
        const locCards = player === 'player' ? loc.player_cards : loc.opponent_cards;
        let locationPower = 0;
        let locationSource = null;
        let isLocationReduction = false;
        
        if (loc.effect_type === 'power_boost') {
            locationPower = loc.effect_value;
            locationSource = `${loc.name} (+${loc.effect_value})`;
        } else if (loc.effect_type === 'single_card_bonus' && locCards.length === 1) {
            locationPower = loc.effect_value;
            locationSource = `${loc.name} (+${loc.effect_value})`;
        } else if (loc.effect_type === 'reduce_all_power') {
            locationPower = loc.effect_value;
            locationSource = `${loc.name} (-${loc.effect_value})`;
            isLocationReduction = true;
        }
        // Add more effect types as needed
        if (locationPower !== 0) {
            const locItem = document.createElement('div');
            locItem.className = isLocationReduction ? 'power-breakdown-item negative' : 'power-breakdown-item positive';
            locItem.innerHTML = `<span>Location Effect:</span><span>${isLocationReduction ? '-' : '+'}${locationPower}</span>`;
            breakdownContainer.appendChild(locItem);

            // Show source
            const sourceItem = document.createElement('div');
            sourceItem.className = isLocationReduction ? 'power-breakdown-item negative' : 'power-breakdown-item positive';
            sourceItem.style.marginLeft = '1rem';
            sourceItem.style.fontSize = '0.9em';
            sourceItem.innerHTML = `<span>• ${locationSource}</span>`;
            breakdownContainer.appendChild(sourceItem);
        }

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

        // Power reductions from all cards (affects everyone)
        const allCards = [...location.player_cards, ...location.opponent_cards];
        
        let totalAllReduction = 0;
        const allReductionSources = [];
        allCards.forEach(allCard => {
            if (allCard.ability_type === 'ongoing' && 
                allCard.ability_effect && 
                allCard.ability_effect.type === 'reduce_all_power') {
                totalAllReduction += allCard.ability_effect.value;
                allReductionSources.push(`${allCard.name} (-${allCard.ability_effect.value})`);
            }
        });

        if (totalAllReduction > 0) {
            const allReductionItem = document.createElement('div');
            allReductionItem.className = 'power-breakdown-item negative';
            allReductionItem.innerHTML = `<span>Global Power Reductions:</span><span>-${totalAllReduction}</span>`;
            breakdownContainer.appendChild(allReductionItem);
            
            // Add individual reduction sources
            allReductionSources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'power-breakdown-item negative';
                sourceItem.style.marginLeft = '1rem';
                sourceItem.style.fontSize = '0.9em';
                sourceItem.innerHTML = `<span>• ${source}</span>`;
                breakdownContainer.appendChild(sourceItem);
            });
        }

        // Card abilities that activate when alone
        if (card.ability_type === 'ongoing' && 
            card.ability_effect && 
            card.ability_effect.type === 'when_alone' &&
            locCards.length === 1) {
            const aloneItem = document.createElement('div');
            aloneItem.className = 'power-breakdown-item positive';
            aloneItem.innerHTML = `<span>Card Ability:</span><span>+${card.ability_effect.value}</span>`;
            breakdownContainer.appendChild(aloneItem);

            // Show source
            const sourceItem = document.createElement('div');
            sourceItem.className = 'power-breakdown-item positive';
            sourceItem.style.marginLeft = '1rem';
            sourceItem.style.fontSize = '0.9em';
            sourceItem.innerHTML = `<span>• ${card.name} (+${card.ability_effect.value})</span>`;
            breakdownContainer.appendChild(sourceItem);
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
        document.getElementById('modalCostBreakdown').innerHTML = ''; // Reset cost breakdown
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiplayerGame();
}); 