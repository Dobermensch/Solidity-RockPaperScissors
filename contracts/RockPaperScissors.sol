// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RockPaperScissors is ReentrancyGuard {
    using SafeMath for uint256;

    enum GameOutcome {
        Draw,
        PlayerOne,
        PlayerTwo
    }

    struct GameResult {
        address playerOne;
        address playerTwo;
        GameOutcome outcome;
    }

    uint public constant REVEAL_TIMEOUT = 10 minutes;
    uint public firstReveal;
    address payable public playerOne;
    address payable public playerTwo;
    bytes32 public hashedPlayerOneMove;
    bytes32 public hashedPlayerTwoMove;
    uint public playerOneMove;
    uint public playerTwoMove;
    uint256 public initialBet;
    GameResult[] public gamesPlayedResults;
    event PlayerJoined(address indexed player);
    event PlayerMadeMove(address indexed player);
    event GameOver(GameResult result);

    mapping(address => uint256) public playerBalances;

    modifier validBet() {
        require(
            initialBet == 0 || msg.value >= initialBet,
            "Your bet amount needs to be greater than or equal to the initialBet"
        );
        _;
    }

    function join() public payable validBet returns (uint256) {
        require(
            msg.sender != playerOne && msg.sender != playerTwo,
            "You've already joined as a player"
        );

        if (playerOne == address(0x0)) {
            playerOne = payable(msg.sender);
            playerBalances[msg.sender] = msg.value;
            initialBet = msg.value;
            emit PlayerJoined(playerOne);
            return 1;
        } else if (playerTwo == address(0x0)) {
            playerTwo = payable(msg.sender);
            playerBalances[msg.sender] = msg.value;
            emit PlayerJoined(playerTwo);
            return 2;
        }

        return 0;
    }

    function playGame(bytes32 hashedMove) public returns (bool) {
        require(
            playerOne != address(0x0) && playerTwo != address(0x0),
            "Game needs more players to join first"
        );
        require(
            msg.sender == playerOne || msg.sender == playerTwo,
            "You did not join the game as a player"
        );

        if (msg.sender == playerOne && hashedPlayerOneMove == "") {
            hashedPlayerOneMove = hashedMove;
            emit PlayerMadeMove(playerOne);
        } else if (msg.sender == playerTwo && hashedPlayerTwoMove == "") {
            hashedPlayerTwoMove = hashedMove;
            emit PlayerMadeMove(playerTwo);
        } else {
            return false;
        }

        return true;
    }

    function revealPlayerChoice(uint256 move, bytes32 password) public {
        require(
            hashedPlayerOneMove != bytes32(0x0) &&
                hashedPlayerTwoMove != bytes32(0x0),
            "The game is still running!"
        );

        if (
            // one player has revealed move but the other hasn't and max time to do so has elapsed
            (firstReveal != 0 &&
                block.timestamp > firstReveal + REVEAL_TIMEOUT) &&
            ((playerOneMove != 0 &&
                playerTwoMove == 0 &&
                msg.sender == playerOne) ||
                (playerTwoMove != 0 &&
                    playerOneMove == 0 &&
                    msg.sender == playerTwo))
        ) {
            // penalizing players who don't reveal their choice
            uint256 playerOneBalance = playerBalances[playerOne];
            playerBalances[playerOne] -= playerOneBalance;

            uint256 playerTwoBalance = playerBalances[playerTwo];
            playerBalances[playerTwo] -= playerTwoBalance;

            uint256 totalBalance = playerTwoBalance + playerOneBalance;
            msg.sender.call{value: totalBalance}("");

            resetGame();
            return;
        }

        bytes32 hashedAnswer = keccak256(abi.encodePacked(move, password));

        if (msg.sender == playerOne && hashedAnswer == hashedPlayerOneMove) {
            playerOneMove = move;
        } else if (
            msg.sender == playerTwo && hashedAnswer == hashedPlayerTwoMove
        ) {
            playerTwoMove = move;
        }

        if ((playerOneMove != 0 || playerTwoMove != 0) && firstReveal == 0) {
            firstReveal = block.timestamp;
        }

        if (playerOneMove != 0 && playerTwoMove != 0) {
            getGameOutcome();
        }
    }

    function getGameOutcome() internal {
        require(
            playerOneMove != 0 && playerTwoMove != 0,
            "Not all players have revealed their choice yet"
        );
        address payable winner;
        GameOutcome outcome = GameOutcome.Draw;

        if (playerOneMove == playerTwoMove) {
            uint256 playerOneBalance = playerBalances[playerOne];
            playerBalances[playerOne] -= playerOneBalance;
            playerOne.call{value: playerOneBalance}("");

            uint256 playerTwoBalance = playerBalances[playerTwo];
            playerBalances[playerTwo] -= playerTwoBalance;
            playerTwo.call{value: playerTwoBalance}("");
        } else if (
            (playerOneMove == 1 && playerTwoMove == 2) ||
            (playerOneMove == 2 && playerTwoMove == 3) ||
            (playerOneMove == 3 && playerTwoMove == 1)
        ) {
            winner = playerTwo;
            outcome = GameOutcome.PlayerTwo;
        } else {
            winner = playerOne;
            outcome = GameOutcome.PlayerOne;
        }

        GameResult memory result = GameResult({
            playerOne: playerOne,
            playerTwo: playerTwo,
            outcome: outcome
        });

        gamesPlayedResults.push(result);

        uint256 playerTwoBalance = playerBalances[playerTwo];
        playerBalances[playerTwo] -= playerTwoBalance;

        uint256 playerOneBalance = playerBalances[playerOne];
        playerBalances[playerOne] -= playerOneBalance;

        resetGame();
        uint256 totalBalance = playerTwoBalance + playerOneBalance;
        winner.call{value: totalBalance}("");
        emit GameOver(result);
    }

    function resetGame() internal {
        playerOne = payable(0x0);
        playerTwo = payable(0x0);
        playerOneMove = 0;
        playerTwoMove = 0;
        hashedPlayerOneMove = "";
        hashedPlayerTwoMove = "";
        firstReveal = 0;
    }

    function getHistoricalGameAtIndex(uint256 index)
        public
        view
        returns (GameResult memory)
    {
        require(
            index < gamesPlayedResults.length,
            "Please enter a valid index"
        );
        return gamesPlayedResults[index];
    }
}
