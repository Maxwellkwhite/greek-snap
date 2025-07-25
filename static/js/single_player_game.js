// Single Player Greek Snap Game JavaScript

class SinglePlayerGame {
    constructor() {
        this.selectedCard = null;
        this.draggedCardIndex = null;
        this.gameState = null;
        this.isPlayerTurn = true;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startNewGame();
    }

    setupEventListeners() {
        // End turn button
        document.getElementById('endTurnBtn').addEventListener('click', () => {
            this.endTurn();
        });



        // Back to menu button in modal
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            window.location.href = '/';
        });

        // Play again button in modal
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.startNewGame();
            const modal = bootstrap.Modal.getInstance(document.getElementById('gameOverModal'));
            modal.hide();
        });

        // Card detail modal close button
        document.getElementById('cardDetailModal').addEventListener('hidden.bs.modal', () => {
            // Reset modal content when closed
            this.resetModalContent();
        });
    }

    async startNewGame() {
        try {
            const response = await fetch('/api/new-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState = data.game_state;
                this.isPlayerTurn = true;
                this.updateUI();
                this.showNotification('New game started!', 'success');
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('Error starting new game:', error);
            this.showError('Failed to start new game');
        }
    }

    updateUI() {
        if (!this.gameState) {
            console.log('No game state available for UI update');
            return;
        }

        console.log('Updating UI with game state:', this.gameState);






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



    updateControls() {
        const handAndControls = document.getElementById('handAndControls');
        const endTurnBtn = document.getElementById('endTurnBtn');
        
        if (this.isPlayerTurn) {
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
            cardDiv.style.cursor = 'pointer';
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
            cardDiv.style.cursor = 'pointer';
            cardDiv.addEventListener('click', () => {
                this.showCardDetail(card, locationIndex, 'player', cardIndex);
            });
            playerCardsContainer.appendChild(cardElement);
        });

        // Add drop zone functionality to player drop zone only (if not full and it's your turn)
        if (!playerIsFull && this.isPlayerTurn) {
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
        
        // Check if card is playable and add appropriate functionality
        if (isHandCard) {
            // Check if card is playable (use actual cost for check)
            if (actualCost > this.gameState.player_energy) {
                cardDiv.classList.add('unplayable');
                cardDiv.style.cursor = 'not-allowed';
            } else if (this.isPlayerTurn) {
                // Make card draggable only if it's playable and it's the player's turn
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
        if (!this.isPlayerTurn) {
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
        
        try {
            const response = await fetch('/api/play-card', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    card_index: cardIndex,
                    location_index: locationIndex
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState = data.game_state;
                this.updateUI();
                this.showNotification(data.message, 'success');
                
                // Check if game is over after playing card
                if (this.gameState.game_over) {
                    this.showGameOver({ winner: this.gameState.winner });
                }
                // Note: AI moves only happen when player ends turn, not when playing individual cards
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('Error playing card:', error);
            this.showError('Failed to play card');
        }
    }

    async makeAIMove() {
        console.log('AI making move...', {
            opponent_hand: this.gameState.opponent_hand,
            opponent_energy: this.gameState.opponent_energy,
            current_player: this.gameState.current_player
        });
        
        // Simple AI: play a random playable card to a random location
        if (this.gameState.opponent_hand && this.gameState.opponent_hand.length > 0 && this.gameState.opponent_energy > 0) {
            // Find playable cards
            const playableCards = [];
            for (let i = 0; i < this.gameState.opponent_hand.length; i++) {
                const card = this.gameState.opponent_hand[i];
                if (card.cost <= this.gameState.opponent_energy) {
                    playableCards.push(i);
                }
            }
            
            console.log('Playable cards:', playableCards);
            
            if (playableCards.length > 0) {
                // Find locations that aren't full
                const availableLocations = [];
                for (let i = 0; i < this.gameState.locations.length; i++) {
                    const location = this.gameState.locations[i];
                    if (location.opponent_cards.length < 4) {
                        availableLocations.push(i);
                    }
                }
                
                console.log('Available locations:', availableLocations);
                
                if (availableLocations.length > 0) {
                    // Play a random playable card to a random available location
                    const cardIndex = playableCards[Math.floor(Math.random() * playableCards.length)];
                    const locationIndex = availableLocations[Math.floor(Math.random() * availableLocations.length)];
                    
                    console.log('AI playing card', cardIndex, 'to location', locationIndex);
                    
                    try {
                        const response = await fetch('/api/ai-play-card', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                card_index: cardIndex,
                                location_index: locationIndex
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            this.gameState = data.game_state;
                            this.updateUI();
                            this.showNotification('AI played a card', 'info');
                            
                            // Check if game is over after AI move
                            if (this.gameState.game_over) {
                                this.showGameOver({ winner: this.gameState.winner });
                            } else {
                                // Continue AI turn if it can play more cards
                                setTimeout(() => {
                                    this.makeAIMove();
                                }, 500);
                            }
                        } else {
                            console.log('AI play failed:', data.message);
                            // If AI can't play this card, end the turn automatically
                            this.endAITurn();
                        }
                    } catch (error) {
                        console.error('Error with AI move:', error);
                        this.endAITurn();
                    }
                } else {
                    console.log('No available locations, ending AI turn');
                    this.endAITurn();
                }
            } else {
                console.log('No playable cards, ending AI turn');
                this.endAITurn();
            }
        } else {
            console.log('AI has no hand or energy, ending turn');
            this.endAITurn();
        }
    }



    async endAITurn() {
        console.log('AI ending turn...');
        try {
            const response = await fetch('/api/ai-end-turn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState = data.game_state;
                this.isPlayerTurn = true;
                this.updateUI();
                this.showNotification('AI ended its turn', 'info');
                
                // Check if game is over
                if (this.gameState.game_over) {
                    this.showGameOver({ winner: this.gameState.winner });
                }
            } else {
                console.log('AI end turn failed:', data.message);
            }
        } catch (error) {
            console.error('Error ending AI turn:', error);
        }
    }

    async endTurn() {
        if (!this.isPlayerTurn) {
            this.showError("Not your turn!");
            return;
        }
        
        try {
            const response = await fetch('/api/end-turn', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameState = data.game_state;
                this.isPlayerTurn = false;
                this.updateUI();
                this.showNotification(data.message, 'info');
                
                // Check if game is over
                if (this.gameState.game_over) {
                    this.showGameOver({ winner: this.gameState.winner });
                } else {
                    // AI turn - make AI moves
                    setTimeout(() => {
                        this.makeAIMove();
                    }, 1000);
                }
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('Error ending turn:', error);
            this.showError('Failed to end turn');
        }
    }

    async showGameOver(data) {
        // Award XP first
        let xpInfo = null;
        try {
            const result = data.winner === 'player' ? 'win' : data.winner === 'opponent' ? 'loss' : 'tie';
            const response = await fetch('/api/game-result', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    result: result
                })
            });
            
            const xpData = await response.json();
            if (xpData.success) {
                xpInfo = {
                    xp_awarded: xpData.message.includes('+') ? parseInt(xpData.message.match(/\+(\d+)/)[1]) : 0,
                    new_total_xp: xpData.new_xp,
                    leveled_up: xpData.leveled_up,
                    new_level: xpData.new_level,
                    progress: xpData.progress,
                    xp_for_next: xpData.xp_for_next
                };
            }
        } catch (error) {
            console.error('Error awarding XP:', error);
        }
        
        // Clear the game state from the server
        try {
            await fetch('/api/clear-game-state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
        } catch (error) {
            console.error('Error clearing game state:', error);
        }
        
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
        if (xpInfo) {
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

        // Location effect
        const loc = this.gameState.locations[locationIndex];
        const locCards = player === 'player' ? loc.player_cards : loc.opponent_cards;
        const opponentCards = player === 'player' ? loc.opponent_cards : loc.player_cards;
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

        // Power boosts from ongoing abilities (other cards)
        let totalBoost = 0;
        const boostSources = [];
        locCards.forEach(otherCard => {
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

        // "When alone" ability for this card
        if (card.ability_type === 'ongoing' && 
            card.ability_effect && 
            card.ability_effect.type === 'when_alone' && 
            locCards.length === 1) {
            const aloneItem = document.createElement('div');
            aloneItem.className = 'power-breakdown-item positive';
            aloneItem.innerHTML = `<span>When Alone Bonus:</span><span>+${card.ability_effect.value}</span>`;
            breakdownContainer.appendChild(aloneItem);
            
            const sourceItem = document.createElement('div');
            sourceItem.className = 'power-breakdown-item positive';
            sourceItem.style.marginLeft = '1rem';
            sourceItem.style.fontSize = '0.9em';
            sourceItem.innerHTML = `<span>• ${card.name} (+${card.ability_effect.value})</span>`;
            breakdownContainer.appendChild(sourceItem);
        }

        // Power reductions from opponent cards
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
    new SinglePlayerGame();
}); 