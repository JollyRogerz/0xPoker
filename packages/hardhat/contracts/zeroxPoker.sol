pragma solidity >=0.8.0 <0.9.0;

//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/access/Ownable.sol";


contract zeroxPoker is Ownable {

    address public deployer;

    constructor(address initialOwner) {
		super.transferOwnership(initialOwner);
        deployer = initialOwner;
	}

    // 4 Game Phases: Join, Commit, Reveal, Result
    enum GameState {
        JoinPhase,
        CommitPhase,
        RevealPhase,
        ResultPhase
    }
    // 3 Game Results: P1 win, P2 win, draw
    enum GameResult {
        P1Win,
        P2Win,
        Draw
    }
    // Store the hashes for each hand easy comparison
    bytes32 royalFlushHash = keccak256(abi.encodePacked("Royal Flush"));
    bytes32 straightFlushHash = keccak256(abi.encodePacked("Straight Flush"));
    bytes32 fourOfAKindHash = keccak256(abi.encodePacked("Four of a Kind"));
    bytes32 fullHouseHash = keccak256(abi.encodePacked("Full House"));
    bytes32 flushHash = keccak256(abi.encodePacked("Flush"));
    bytes32 straightHash = keccak256(abi.encodePacked("Straight"));
    bytes32 threeOfAKindHash = keccak256(abi.encodePacked("Three of a Kind"));
    bytes32 twoPairsHash = keccak256(abi.encodePacked("Two Pairs"));
    bytes32 onePairHash = keccak256(abi.encodePacked("One Pair"));
    bytes32 noSequenceHash = keccak256(abi.encodePacked("No Sequence"));

    // Holds the game data for a single match
    struct GameStruct {
        bool initialized;
        address player1;
        address player2;
        GameState gameState;
        bytes32 commit1;
        bytes32 commit2;
        bytes32 reveal1;
        bytes32 reveal2;
        uint256 revealDeadline;
        uint256 betAmount;
        GameResult gameResult;
    }
        
        uint256 public totalBalance;


    // Maps Game address => Game data
    mapping(address => GameStruct) public games;
    // Maps Player address to their current 'active' game
    mapping(address => address) public activeGame;
    //Checks if a player has already commited 
    mapping(address => mapping(address => bool)) public hasCommitted;

    /**
     * @notice Modifier that checks game is initialized, the sender is player 1/2
     * and that the game state to be in the expected phase
     * @param gameHash - the game code
     * @param gameState - the three possible game phases
     */
    modifier validGameState(address gameHash, GameState gameState) {
        // Check that the game exists
        require(
            games[gameHash].initialized == true,
            "Game code does not exist"
        );
        // Check player is either player 1 or player 2
        require(
            games[gameHash].player1 == msg.sender ||
                games[gameHash].player2 == msg.sender,
            "Player not in this game"
        );
        // Check that game is in expected state
        require(
            games[gameHash].gameState == gameState,
            "Game not in correct phase"
        );
        _;
    }

    /**
     * @notice Creates a new game, generating a game hash and setting player 1 as sender
     *  and player 2 as the address provided
     * @param otherPlayer - address for player 2
     */
    function createGame(address otherPlayer) public returns (address) {
        //
        address gameHash = generateGameHash();
        require(
            !games[gameHash].initialized,
            "Game code already exists, please try again"
        );
        // Check other player isn't host
        require(
            msg.sender != otherPlayer,
            "Invited player must have a different address"
        );

        games[gameHash].initialized = true;
        games[gameHash].player1 = msg.sender;
        games[gameHash].player2 = otherPlayer;

        // Set game phase to initial join phase
        games[gameHash].gameState = GameState.JoinPhase;

        // Set P1 active game to game hash
        activeGame[msg.sender] = gameHash;

        // Return the game hash so it can be shared
        return gameHash;
    }

    /**
     * @notice Function for player 2 to join a game with the game address
     * @param gameHash - game address shared by player 1
     */
    function joinGame(address gameHash)
        public
        validGameState(gameHash, GameState.JoinPhase)
    {
        // Set game phase to commit phase
        games[gameHash].gameState = GameState.CommitPhase;

        // Set P2 active game to game hash
        activeGame[msg.sender] = gameHash;
    }

    
    function commit(string memory pokerHand, string memory salt)
        public
        payable
        validGameState(activeGame[msg.sender], GameState.CommitPhase)
    {
        // Get the game hash from active game mapping
        address gameHash = activeGame[msg.sender];

        require(!hasCommitted[msg.sender][gameHash], "Player has already committed");

        bytes32 unsaltedPokerHandHash = keccak256(abi.encodePacked(pokerHand));

        // Check if choice  is valid 
        require(
                unsaltedPokerHandHash == royalFlushHash ||
                unsaltedPokerHandHash == straightFlushHash ||
                unsaltedPokerHandHash == fullHouseHash ||
                unsaltedPokerHandHash == fourOfAKindHash ||
                unsaltedPokerHandHash == flushHash ||
                unsaltedPokerHandHash == straightHash ||
                unsaltedPokerHandHash == threeOfAKindHash ||
                unsaltedPokerHandHash == twoPairsHash ||
                unsaltedPokerHandHash == onePairHash ||
                unsaltedPokerHandHash == noSequenceHash,
                    "Invalid poker hand"
        );

        // Generate commit hash with pokerHand + user chosen salt
        bytes32 commitHash = keccak256(abi.encodePacked(pokerHand, salt));

        bool isPlayer1 = games[gameHash].player1 == msg.sender;
        if (isPlayer1) {
            games[gameHash].commit1 = commitHash;
        } else {
            games[gameHash].commit2 = commitHash;
        }

        // Mark the player as having committed
        hasCommitted[msg.sender][gameHash] = true;  

        // Store the amount of ether sent with the commit
        games[gameHash].betAmount = msg.value;
        totalBalance += msg.value;


        // If both player have committed, set game state to reveal phase
        if (games[gameHash].commit1 != 0 && games[gameHash].commit2 != 0) {
            games[gameHash].gameState = GameState.RevealPhase;
        }
    }

    /**
     * @notice Function for players to reveal their choice. The first player to reveal sets a deadline for the second player
     * this is prevent players for abandoning the game once they know they have lost based on the revealed hash.
     * At the end of the deadline, the player who committed can trigger a "win-by-default".
     * If both players reveal in time, the second player's reveal will call determineWinner() and advance the game to the result phase
     * @notice Unlike commit, players can only reveal once
     * @param salt - a player chosen secret string from the "commit" phase used to prove their choice via a hash match
     */
    function reveal(string memory salt)
        public
        validGameState(activeGame[msg.sender], GameState.RevealPhase)
    {
        // Get the game hash from active game mapping
        address gameHash = activeGame[msg.sender];

        bool isPlayer1 = games[gameHash].player1 == msg.sender;
        // Check that player hasn't already revealed
        if (isPlayer1) {
            require(games[gameHash].reveal1 == 0, "Already revealed");
        } else {
            require(games[gameHash].reveal2 == 0, "Already revealed");
        }

        // Verify that one of the pokerHands + salt hashes matches commit hash
        // Compare all nine possible pokerHands so they don't have to enter their choice again

        bytes32 verificationHashroyalFlush = keccak256(abi.encodePacked("Royal Flush", salt));
        bytes32 verificationHashstraightFlush  = keccak256(abi.encodePacked("Straight Flush", salt));
        bytes32 verificationHashfourOfAKind  = keccak256(abi.encodePacked("Four of a Kind", salt));
        bytes32 verificationHashfullHouse  = keccak256(abi.encodePacked("Full House", salt));
        bytes32 verificationHashflush  = keccak256(abi.encodePacked("Flush", salt));
        bytes32 verificationHashstraight  = keccak256(abi.encodePacked("Straight", salt));
        bytes32 verificationHashthreeOfAKind  = keccak256(abi.encodePacked("Three of a Kind", salt));
        bytes32 verificationHashtwoPairs  = keccak256(abi.encodePacked("Two Pairs", salt));
        bytes32 verificationHashonePair  = keccak256(abi.encodePacked("One Pair", salt));
        bytes32 verificationHashnoSequence  = keccak256(abi.encodePacked("No Sequence", salt));

        bytes32 commitHash = isPlayer1 ? games[gameHash].commit1 : games[gameHash].commit2;

        require(
                verificationHashroyalFlush == commitHash ||
                verificationHashstraightFlush == commitHash ||
                verificationHashfourOfAKind == commitHash ||
                verificationHashfullHouse == commitHash ||
                verificationHashflush == commitHash ||
                verificationHashstraight == commitHash ||
                verificationHashthreeOfAKind == commitHash ||
                verificationHashtwoPairs == commitHash ||
                verificationHashonePair == commitHash ||
                verificationHashnoSequence == commitHash,
            "Reveal hash doesn't match commit hash. Salt not the same as commit."
        );
        // Work backwards to infer their pokerHand
        string memory pokerHand;
        if (verificationHashroyalFlush == commitHash) {
            pokerHand = "Royal Flush";
        } else if (verificationHashstraightFlush == commitHash) {
            pokerHand = "Straight Flush";
        } else if (verificationHashfourOfAKind == commitHash) {
            pokerHand = "Four of a Kind";
        } else if (verificationHashfullHouse == commitHash) {
            pokerHand = "Full House";
        } else if (verificationHashflush == commitHash) {
            pokerHand = "Flush";
        } else if (verificationHashstraight == commitHash) {
            pokerHand = "Straight";
        } else if (verificationHashthreeOfAKind == commitHash) {
            pokerHand = "Three of a Kind";
        } else if (verificationHashtwoPairs == commitHash) {
            pokerHand = "Two Pairs";
        } else if (verificationHashonePair == commitHash) {
            pokerHand = "One Pair";
        } else {
            pokerHand = "No Sequence";
        }

        // Save the revealed hash w/o salt
        if (isPlayer1) {
            games[gameHash].reveal1 = keccak256(abi.encodePacked(pokerHand));
        } else {
            games[gameHash].reveal2 = keccak256(abi.encodePacked(pokerHand));
        }
        // if both players revealed, determine winner
        if (games[gameHash].reveal1 != 0 && games[gameHash].reveal2 != 0) {
            games[gameHash].gameResult = determineWinner(
                games[gameHash].reveal1,
                games[gameHash].reveal2
            );
            games[gameHash].gameState = GameState.ResultPhase;
        } else {
            // Set deadline for other player to reveal
            games[gameHash].revealDeadline = block.timestamp + 3 minutes;
        }
    }
    /**
     * @notice Escape function if a player does not reveal in time. The other player
     * can call this function to trigger a "win-by-default"
     */
    function determineDefaultWinner()
        public
        validGameState(activeGame[msg.sender], GameState.RevealPhase)
    {
        // Get the game hash from active game mapping
        address gameHash = activeGame[msg.sender];
        games[gameHash].gameResult = determineWinner(
            games[gameHash].reveal1,
            games[gameHash].reveal2
        );
        games[gameHash].gameState = GameState.ResultPhase;
        distributeWinnings();
        leaveGame();
    }
    /**
     * @notice Players can use this to leave the game at anytime. Usually at the end to reset the UI
     */
    function leaveGame() public {
        activeGame[msg.sender] = address(0);
    }
    /// @notice Util Functions for generating hashes, computing winners and fetching data
    function generateGameHash() public view returns (address) {
        bytes32 prevHash = blockhash(block.number - 1);
        // Game hash is a pseudo-randomly generated address from last blockhash + p1
        return
            address(bytes20(keccak256(abi.encodePacked(prevHash, msg.sender))));
    }
    /**
     * @notice Determine the winner based on reveals for p1 and p2
     * If only 1 has revealed, they win by default
     * @param revealP1 - p1's reveal, defaults to 0 if not set
     * @param revealP2 - p2's reveal, defaults to 0 if not set
     */
    function determineWinner(bytes32 revealP1, bytes32 revealP2)
        public
        view
        returns (GameResult)
    {
        // If both players have revealed, determine the winner
        if (revealP1 != 0 && revealP2 != 0) {
            if (revealP1 == revealP2) {
                return GameResult.Draw;
            }
            if (revealP1 == royalFlushHash) {
                if (revealP2 == straightFlushHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == fourOfAKindHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == fullHouseHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == flushHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == straightHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == threeOfAKindHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == twoPairsHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == onePairHash) {
                    return GameResult.P1Win;
                } else if (revealP2 == noSequenceHash) {
                    return GameResult.P1Win;
                }
        } else if (revealP1 == straightFlushHash) {
           if (revealP2 == fourOfAKindHash) {
                return GameResult.P1Win;
            } else if (revealP2 == fullHouseHash) {
                return GameResult.P1Win;
            } else if (revealP2 == flushHash) {
                return GameResult.P1Win;
            } else if (revealP2 == straightHash) {
                return GameResult.P1Win;
            } else if (revealP2 == threeOfAKindHash) {
                return GameResult.P1Win;
            } else if (revealP2 == twoPairsHash) {
                return GameResult.P1Win;
            } else if (revealP2 == onePairHash) {
                return GameResult.P1Win;
            } else if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == fourOfAKindHash) {
           if (revealP2 == fullHouseHash) {
                return GameResult.P1Win;
            } else if (revealP2 == flushHash) {
                return GameResult.P1Win;
            } else if (revealP2 == straightHash) {
                return GameResult.P1Win;
            } else if (revealP2 == threeOfAKindHash) {
                return GameResult.P1Win;
            } else if (revealP2 == twoPairsHash) {
                return GameResult.P1Win;
            } else if (revealP2 == onePairHash) {
                return GameResult.P1Win;
            } else if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == fullHouseHash) {
           if (revealP2 == flushHash) {
                return GameResult.P1Win;
            } else if (revealP2 == straightHash) {
                return GameResult.P1Win;
            } else if (revealP2 == threeOfAKindHash) {
                return GameResult.P1Win;
            } else if (revealP2 == twoPairsHash) {
                return GameResult.P1Win;
            } else if (revealP2 == onePairHash) {
                return GameResult.P1Win;
            } else if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == flushHash) {
           if (revealP2 == straightHash) {
                return GameResult.P1Win;
            } else if (revealP2 == threeOfAKindHash) {
                return GameResult.P1Win;
            } else if (revealP2 == twoPairsHash) {
                return GameResult.P1Win;
            } else if (revealP2 == onePairHash) {
                return GameResult.P1Win;
            } else if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == straightHash) {
           if (revealP2 == threeOfAKindHash) {
                return GameResult.P1Win;
            } else if (revealP2 == twoPairsHash) {
                return GameResult.P1Win;
            } else if (revealP2 == onePairHash) {
                return GameResult.P1Win;
            } else if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == threeOfAKindHash) {
           if (revealP2 == twoPairsHash) {
                return GameResult.P1Win;
            } else if (revealP2 == onePairHash) {
                return GameResult.P1Win;
            } else if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == twoPairsHash) {
           if (revealP2 == onePairHash) {
                return GameResult.P1Win;
            } else if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == onePairHash) {
           if (revealP2 == noSequenceHash) {
                return GameResult.P1Win;
            } else {
                return GameResult.P2Win;
            }
        } else if (revealP1 == noSequenceHash) {
            return GameResult.P2Win;
            }
        }
     
        // Else the winner by default is the player that has revealed
        else if (revealP1 != 0) {
            return GameResult.P1Win;
        } else {
            return GameResult.P2Win;
        }
    }

    function distributeWinnings() public {
    
        address gameHash = activeGame[msg.sender];
        games[gameHash].gameState = GameState.ResultPhase; 

        // If the game has reached the ResultPhase
        if (games[gameHash].gameState == GameState.ResultPhase) {
            // Determine the winner
            address winner;
            address winner2;

            // Calculate the total winnings
            uint256 totalPot = totalBalance;
            uint256 deployerCutWinnings = totalPot *  5 /  100; // Calculate  5% of Winnings
            uint256 winnings = totalBalance - deployerCutWinnings; 

            uint256 halfWinnings = winnings/2;


            //Determine Winner and send prize
            if (games[gameHash].gameResult == GameResult.P1Win) {
                winner = games[gameHash].player1;
                payable(winner).transfer(winnings);
                payable(deployer).transfer(deployerCutWinnings);
            } 
            else if (games[gameHash].gameResult == GameResult.P2Win) {
                winner = games[gameHash].player2;
                payable(winner).transfer(winnings);
                payable(deployer).transfer(deployerCutWinnings);
            } 
            else if (games[gameHash].gameResult == GameResult.Draw) {
                winner = games[gameHash].player1;
                winner2 = games[gameHash].player2;
                payable(winner).transfer(halfWinnings);
                payable(winner2).transfer(halfWinnings);
                payable(deployer).transfer(deployerCutWinnings);
            }

            // Reset the game state and bet amount
            // games[gameHash].gameState = GameState.JoinPhase;
            // games[gameHash].initialized = false;
            games[gameHash].betAmount = 0;
            totalBalance = 0;
            leaveGame();
        }
    }
    /**
     * @notice Fetches the game data of the player's active game
     * @param player - address of player
     */
    function getActiveGameData(address player)
        public
        view
        returns (GameStruct memory)
    {
        // Get the game hash from active game mapping
        address gameHash = activeGame[player];
        return games[gameHash];
    }
}