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
        
        // Apply hand cost increases from Ares or other effects
        const handCostIncrease = this.gameState.player_hand_cost_increase || 0;
        
        // Apply global cost reduction and hand cost increases to all cards
        actualCost = Math.max(0, baseCost + handCostIncrease - globalCostReduction);
        
        costElement.textContent = actualCost;
        
        // Add visual feedback for cost changes
        if (actualCost !== baseCost) {
            costElement.classList.remove('cost-reduced', 'cost-increased');
            if (actualCost < baseCost) {
                costElement.classList.add('cost-reduced');
                costElement.title = `Base: ${baseCost}, Actual: ${actualCost} (-${baseCost - actualCost})`;
            } else if (actualCost > baseCost) {
                costElement.classList.add('cost-increased');
                costElement.title = `Base: ${baseCost}, Actual: ${actualCost} (+${actualCost - baseCost})`;
            }
        } else {
            costElement.title = `Cost: ${actualCost}`;
        }
        
        cardDiv.querySelector('.card-name').textContent = card.name;
        
        // Show modified power if available, else base power
        const powerElement = cardDiv.querySelector('.card-power');
        const powerToShow = card.modified_power !== undefined ? card.modified_power : card.power;
        powerElement.textContent = powerToShow;
        
        // Handle different power states for cards on board/hand
        powerElement.classList.remove('modified', 'negative');
        
        if (card.modified_power !== undefined && card.modified_power !== card.power) {
            if (card.modified_power > card.power) {
                // Power increased - green
                powerElement.classList.add('modified');
                powerElement.title = `Base: ${card.power}, Modified: ${powerToShow} (+${card.modified_power - card.power})`;
            } else if (card.modified_power < card.power) {
                // Power decreased - red
                powerElement.classList.add('negative');
                powerElement.title = `Base: ${card.power}, Modified: ${powerToShow} (${card.modified_power - card.power})`;
            }
        } else if (powerToShow < 0) {
            // Negative power (shouldn't happen with base power, but just in case)
            powerElement.classList.add('negative');
            powerElement.title = `Base: ${card.power}, Modified: ${powerToShow}`;
        }
        
        cardDiv.querySelector('.card-ability').textContent = card.ability;

        if (isHandCard && cardIndex !== null) {
            cardDiv.setAttribute('data-card-index', cardIndex);
            
            // Check if card is playable (use actual cost for check)
            if (actualCost > this.gameState.player_energy) {
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
            
            // Add card detail modal functionality for hand cards
            cardDiv.addEventListener('click', (e) => {
                // Prevent the click from triggering drag functionality
                e.stopPropagation();
                this.showCardDetail(card, null, 'hand', cardIndex);
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
        const cardElement = document.querySelector(`[data-card-index="${cardIndex}"]`);
        if (cardElement) {
            cardElement.classList.add('selected');
            this.selectedCard = cardIndex;
        }
    }

    // Drag and Drop Methods
    handleDragStart(e, cardIndex) {
        this.draggedCardIndex = cardIndex;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardIndex);
        
        // Create a clone of the card for the drag image
        const cardClone = e.target.cloneNode(true);
        cardClone.style.position = 'absolute';
        cardClone.style.top = '-1000px';
        cardClone.style.left = '-1000px';
        cardClone.style.zIndex = '10000';
        document.body.appendChild(cardClone);
        
        // Set the drag image to be the cloned card
        e.dataTransfer.setDragImage(cardClone, 60, 80);
        
        // Remove the clone after a short delay
        setTimeout(() => {
            if (cardClone.parentNode) {
                cardClone.parentNode.removeChild(cardClone);
            }
        }, 100);
        
        // Add dragging class for visual feedback
        e.target.classList.add('dragging');
    }

    handleDragEnd(e) {
        // Reset all drop zones
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.remove('drag-over');
        });
        
        // Remove dragging class from all cards
        document.querySelectorAll('.game-card.dragging').forEach(card => {
            card.classList.remove('dragging');
        });
        
        // Reset dragged card cost display
        const draggedCard = document.querySelector('.game-card[data-card-index="' + this.draggedCardIndex + '"]');
        if (draggedCard && this.draggedCardIndex !== null) {
            const card = this.gameState.player_hand[this.draggedCardIndex];
            const costElement = draggedCard.querySelector('.card-cost');
            
            // Recalculate the actual cost including hand cost increases
            const baseCost = card.cost;
            let globalCostReduction = 0;
            this.gameState.locations.forEach(location => {
                if (location.effect_type === 'cost_reduction') {
                    globalCostReduction += location.effect_value;
                }
            });
            const handCostIncrease = this.gameState.player_hand_cost_increase || 0;
            const actualCost = Math.max(0, baseCost + handCostIncrease - globalCostReduction);
            
            costElement.textContent = actualCost;
            costElement.classList.remove('cost-reduced', 'cost-increased');
            
            if (actualCost !== baseCost) {
                if (actualCost < baseCost) {
                    costElement.classList.add('cost-reduced');
                    costElement.title = `Base: ${baseCost}, Actual: ${actualCost} (-${baseCost - actualCost})`;
                } else if (actualCost > baseCost) {
                    costElement.classList.add('cost-increased');
                    costElement.title = `Base: ${baseCost}, Actual: ${actualCost} (+${actualCost - baseCost})`;
                }
            } else {
                costElement.title = `Cost: ${actualCost}`;
            }
        }
        
        this.draggedCardIndex = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        const dropZone = e.currentTarget;
        dropZone.classList.add('drag-over');
        
        // Show cost preview if dragging a card (using global cost reduction and hand cost increases)
        if (this.draggedCardIndex !== null) {
            const card = this.gameState.player_hand[this.draggedCardIndex];
            
            if (card) {
                const baseCost = card.cost;
                
                // Calculate global cost reduction
                let globalCostReduction = 0;
                this.gameState.locations.forEach(location => {
                    if (location.effect_type === 'cost_reduction') {
                        globalCostReduction += location.effect_value;
                    }
                });
                
                // Apply hand cost increases from Ares or other effects
                const handCostIncrease = this.gameState.player_hand_cost_increase || 0;
                
                const actualCost = Math.max(0, baseCost + handCostIncrease - globalCostReduction);
                
                // Update the dragged card's cost display
                const draggedCard = document.querySelector('.game-card.dragging');
                if (draggedCard) {
                    const costElement = draggedCard.querySelector('.card-cost');
                    costElement.textContent = actualCost;
                    
                    // Add visual feedback for cost changes
                    costElement.classList.remove('cost-reduced', 'cost-increased');
                    if (actualCost < baseCost) {
                        costElement.classList.add('cost-reduced');
                        costElement.title = `Base: ${baseCost}, Actual: ${actualCost} (-${baseCost - actualCost})`;
                    } else if (actualCost > baseCost) {
                        costElement.classList.add('cost-increased');
                        costElement.title = `Base: ${baseCost}, Actual: ${actualCost} (+${actualCost - baseCost})`;
                    } else {
                        costElement.title = `Cost: ${actualCost}`;
                    }
                }
            }
        }
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
        
        // Show base power in the modal's power circle (always blue)
        const powerElement = document.getElementById('modalCardPower');
        powerElement.textContent = card.power;
        powerElement.style.backgroundColor = '#3498db'; // Blue for base power
        
        document.getElementById('modalCardAbility').textContent = card.ability;

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
    new MarvelSnapGame();
});
