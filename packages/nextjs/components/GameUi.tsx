"use client";

import { useState } from "react";
import { Address} from "../components/scaffold-eth";
import { Button, Col, Divider, Row, notification } from "antd";
import humanizeDuration from "humanize-duration";
import { useAccount } from "wagmi";
import { useScaffoldContractWrite } from "~~/hooks/scaffold-eth";
import { useScaffoldContractRead } from "~~/hooks/scaffold-eth";
import { InputBase } from "~~/components/scaffold-eth";
import { AddressInput } from "~~/components/scaffold-eth";
import Deck from '../components/Deck';


const UIState = {
  NoGame: -1, // Show join / host options
  JoinPhase: 0,
  CommitPhase: 1,
  RevealPhase: 2,
  ResultPhase: 3,
};

const GameResult = {
  None: -1, // Show join / host options
  P1Win: 0,
  P2Win: 1,
  Draw: 2,
};

export default function GameUI() {
  const [joinAddress, setJoinAddress] = useState<string | undefined>(undefined);
  const [otherPlayerAddress, setOtherPlayerAddress] = useState<string | undefined>(undefined);
  const [revealSalt, setRevealSalt] = useState<string>("");
  const { address: connectedAddress } = useAccount();
 
  let timeLeft;
  let isPlayer1;
  let playerHasCommitted = false;
  let playerHasRevealed = false;
  let gameResult = GameResult.None;
  let currentUIState = UIState.NoGame;


  const { data: activeGameData } = useScaffoldContractRead({
    contractName: "zeroxPoker",
    functionName: "getActiveGameData",
    args: [connectedAddress],
    watch: true,

  });

  if (activeGameData) {
    const { initialized, gameState } = activeGameData;
    if (initialized) {
      currentUIState = gameState;
      gameResult = activeGameData.gameResult;
    }
    isPlayer1 = connectedAddress === activeGameData.player1;
    playerHasCommitted = isPlayer1
      ? activeGameData.commit1 !== "0x0000000000000000000000000000000000000000000000000000000000000000"
      : activeGameData.commit2 !== "0x0000000000000000000000000000000000000000000000000000000000000000";
    playerHasRevealed = isPlayer1
      ? activeGameData.reveal1 !== "0x0000000000000000000000000000000000000000000000000000000000000000"
      : activeGameData.reveal2 !== "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  const { data: activeGame } = useScaffoldContractRead({
    contractName: "zeroxPoker",
    functionName: "activeGame",
    args: [connectedAddress],
    watch: true,
  });

  let gameStateMessage = "";
  if (currentUIState === UIState.JoinPhase) gameStateMessage = "Waiting for Player 2 to join";
  if (currentUIState === UIState.CommitPhase) {
    gameStateMessage = playerHasCommitted ? "Waiting for other player to commit" : "Waiting for you to commit";
  }
  if (currentUIState === UIState.RevealPhase) {
    gameStateMessage = playerHasRevealed ? "Waiting for other player to reveal" : "Commited. Waiting for you to reveal";
    const timestamp = BigInt(Math.round(Date.now() / 1000));
    timeLeft = activeGameData.revealDeadline > timestamp ? activeGameData.revealDeadline - timestamp : 0;
  }
  if (currentUIState === UIState.ResultPhase) {
    if (gameResult === GameResult.Draw) gameStateMessage = "It's a draw!";
    else if ((isPlayer1 && gameResult === GameResult.P1Win) || (!isPlayer1 && gameResult === GameResult.P2Win)) {
      gameStateMessage = "🏆 You won! 🎉🎉";
    } else {
      gameStateMessage = "😞 You lost!";
    }
  }

  const joinGame = async () => {
    if (!joinAddress) {
      notification["warning"]({
        message: "Address not provided",
        description: "Please enter the game address to join",
      });
      return;
    }

    await jGame();
  };

  const { writeAsync: oPAdress } = useScaffoldContractWrite({
    contractName: "zeroxPoker",
    functionName: "createGame",
    args: [otherPlayerAddress],
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });

  const { writeAsync: jGame } = useScaffoldContractWrite({
    contractName: "zeroxPoker",
    functionName: "joinGame",
    args: [joinAddress],
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });

  const { writeAsync: rReveal } = useScaffoldContractWrite({
    contractName: "zeroxPoker",
    functionName: "reveal",
    args: [revealSalt],
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });

  const { writeAsync: nNewGame } = useScaffoldContractWrite({
    contractName: "zeroxPoker",
    functionName: "leaveGame",
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });

  const { writeAsync: cClaimWin } = useScaffoldContractWrite({
    contractName: "zeroxPoker",
    functionName: "determineDefaultWinner",
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });

  const { writeAsync: cClaimWinz } = useScaffoldContractWrite({
    contractName: "zeroxPoker",
    functionName: "distributeWinnings",
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });

  const createGame = async () => {
    if (!otherPlayerAddress) {
      notification["warning"]({
        message: "Address not provided",
        description: "Please enter the other player's address to create a game",
      });
      return;
    }

    await oPAdress();
  };

  const reveal = async () => {
    if (revealSalt.length === 0) {
      notification["warning"]({
        message: "No password provided",
        description: "Please enter the password used for your commit",
      });
      return;
    }

    await rReveal();
  };

  const claimWin = async () => {
    await cClaimWin();
  };

  const claimWinningz = async () => {
    await cClaimWinz();
  }

  const leaveGame = async () => {
    await nNewGame();
  };

  const renderChoice = (reveal: string) => {
    const royalFlushHash = "0x9f742fcce6fbcecb8179f18d3152bd4854c42a09b6e0fae27aead63b9641c547";
    const straightFlushHash = "0x70a69a3517a917343d6c4c4b440c87ea5e889e26e925b478adfb53f4b41ad250";
    const fourOfAKindHash = "0xc74c4b032cdefd33f1949391c834654cda584177eb791b710d63375d9bc9e47e";
    const fullHouseHash = "0x3ca6dd3081e4bae25944b4767f7fcccde5af90d36ea7cb4c7a45bc852fe948cc";
    const FlushHash = "0xec1e2e78b28deeaf8d76a5c3e26d69f74059b2d826bccbd24a240ced8a551822";
    const StraightHash = "0xe04665a1f0cf20f8072271e8cd548b5f02b332e3f112e19ea70597da24fd3a3a";
    const threeOfAKindHash = "0x7011507567f1bce40a3141d79fcfcf4ff13a810d32c8f15cb51b1eeb907aaadf";
    const twoPairsHash = "0x3eced0537cd42bcd98e1c8519197899413b5f0aa5a3d23b69b0a21ad9534fd9e";
    const onePairHash = "0xcbaf6d8e13cdb02d62358e631fd3c2d829d8958b64957a9a3d76a40f03f71a22";
    const noSequenceHash = "0x7487e3651f5ad0ce626a79be027c31156f09c0a5e77a59c1f3f2ef2093a33a81";

    let choice;

    if (reveal === royalFlushHash) {
      choice = "Royal Flush";
    } else if (reveal === straightFlushHash) {
      choice = "Straight Flush";
    } else if (reveal === fourOfAKindHash) {
      choice = "Four Of A Kind";
    } else if (reveal === fullHouseHash) {
      choice = "Full House";
    } else if (reveal === FlushHash) {
      choice = "Flush";
    } else if (reveal === StraightHash) {
      choice = "Straight Hash";
    } else if (reveal === threeOfAKindHash) {
      choice = "Three Of A Kind";
    } else if (reveal === twoPairsHash) {
      choice = "Two Pairs";
    } else if (reveal === onePairHash) {
      choice = "One Pair";
    } else if (reveal === noSequenceHash) {
      choice = "No Sequence";
    } else {
      return <></>;
    }

    return (
      <div style={{ height: "130px", width: "130px", fontSize: "40px", paddingTop: "32px" }}>
      <div style={{ fontSize: "20px", margin: "20px 0" }}>{`"${choice}"`}</div>
    </div>
    );
  };

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 500, margin: "auto", marginTop: 64 }}>
        <h2>Active Game</h2>
        {activeGame === "0x0000000000000000000000000000000000000000" || !activeGameData ? (
          <h3>-</h3>
        ) : (
          <><Col
            style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
            >
            <Address address={activeGame} size="base" />
            </Col>
            <Row>
              <Col
                span={12}
                style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
              >
                <h2 style={{ marginTop: 16 }}>Player 1</h2>
                <Address address={activeGameData.player1} size="base" />
              </Col>
              <Col
                span={12}
                style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
              >
                <h2 style={{ marginTop: 16 }}>Player 2</h2>
                <Address address={activeGameData.player2} size="base" />
              </Col>
            </Row>
          </>
        )}
        <Divider />
        {currentUIState === UIState.NoGame && (
          <>
            <h2>Join Game</h2>
            <div style={{ margin: 8 }}>
              <InputBase
                name="JoinAddress"
                value={joinAddress}
                placeholder="Input the game address"
                onChange={setJoinAddress}
              />
              <Button className="btn btn-primary" style={{ marginTop: 8 }} onClick={joinGame}>
                Join
              </Button>
            </div>
            <Divider />
            <h2>Create new Game</h2>
            <div style={{ margin: 8 }}>
              <AddressInput
                value={otherPlayerAddress}
                placeholder="Input the address the other player"
                onChange={setOtherPlayerAddress}
              />
              <Button className="btn btn-primary" style={{ marginTop: 8 }} onClick={createGame}>
                Create
              </Button>
            </div>
            <Divider />
          </>
        )}
        {currentUIState === UIState.JoinPhase && (
          <>
            <h2>Game State</h2>
            <h1>{gameStateMessage}</h1>

            <h3>Send them the game address above so they can join</h3>
          </>
        )}
        {currentUIState === UIState.CommitPhase && (
          <>
            <div style={{ margin: 8 }}>
              <h2>Game State</h2>
              <h1>{gameStateMessage}</h1>
            </div>
            {!playerHasCommitted && (
              <>
                <Divider />
                <div style={{ margin: 8 }}>
                  <h2>Place your Bets</h2>
                  <Deck />
                </div>
              </>
            )}
          </>
        )}
        {currentUIState === UIState.RevealPhase && (
          <>
            <div style={{ margin: 8 }}>
              <h2>Game State</h2>
              <h1>{gameStateMessage}</h1>
            </div>
            <Divider />
            <div style={{ margin: 8 }}>
              {!playerHasRevealed ? (
                <>
                  <h2>Reveal</h2>
                  <InputBase
                    placeholder="Password"
                    style={{ textAlign: "center", width: "200px" }}
                    onChange={setRevealSalt}
                    maxLength={15}
                  />
                  <Button className="btn btn-primary" style={{ marginTop: 8 }} onClick={reveal}>
                    Reveal
                  </Button>
                </>
              ) : (
                <>
                  <h2>Time left</h2>
                  {timeLeft !== undefined && (
                    <>
                      <h2>{humanizeDuration(Number(timeLeft) * 1000)}</h2>
                      <h3>If the other player fails to reveal in time, you can claim the win by default</h3>
                    </>
                  )}
                  {timeLeft === 0 && (
                    <Button className="btn btn-primary" style={{ marginTop: 8 }} onClick={claimWin}>
                      Claim win
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {currentUIState === UIState.ResultPhase && (
          <>
            <div style={{ margin: 8 }}>
              <h2>Game State</h2>
              <h1>{gameStateMessage}</h1>
              <Button className="btn btn-primary" style={{ marginTop: 8 }} size="large" onClick={leaveGame}>
                New Game 🔁
              </Button>
            </div>
            <Divider />
            <div style={{ margin: 8 }}>
              <Row>
                <Col
                  span={12}
                  style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
                >
                  <h3>{isPlayer1 ? "You have" : "Player 1 has"} </h3>
                  {renderChoice(activeGameData.reveal1)}
                </Col>
                <Col
                  span={12}
                  style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
                >
                  <h3>{isPlayer1 ? "Player 2 has" : "You have"} </h3>
                  {renderChoice(activeGameData.reveal2)}
                </Col>
              </Row>
                {isPlayer1 && activeGameData.gameResult === 0 && (
                  <Button className="btn btn-primary" style={{ marginTop: 8 }} onClick={claimWinningz}>Redeem Prize</Button>
                )}
                {!isPlayer1 && activeGameData.gameResult === 1 && (
                  <Button className="btn btn-primary" style={{ marginTop: 8 }} onClick={claimWinningz}>Redeem Prize</Button>
                )}
                {activeGameData.gameResult === 2 && (
                  <Button className="btn btn-primary" style={{ marginTop: 8 }} onClick={claimWinningz}>Redeem Prize</Button>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
// if (currentUIState === UIState.ResultPhase) {
//   if (gameResult === GameResult.Draw) gameStateMessage = "It's a draw!";
//   else if ((isPlayer1 && gameResult === GameResult.P1Win) || (!isPlayer1 && gameResult === GameResult.P2Win)) {
//     gameStateMessage = "🏆 You won! 🎉🎉";
//   } else {
//     gameStateMessage = "😞 You lost!";
//   }
// }