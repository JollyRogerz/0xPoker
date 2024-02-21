"use client";

import React, { useState } from "react";
import Card from "./Card";
import { EtherInput } from "~~/components/scaffold-eth";
import { notification } from "antd";
import { useScaffoldContractWrite } from "~~/hooks/scaffold-eth";
import { InputBase } from "~~/components/scaffold-eth";
import { parseEther } from "viem";


const CARD_SUITS = ["♠", "♣", "♥", "♦"];
const CARD_VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];


const CardObject = (suit, value) => ({ suit, value });

const shuffle = (deck) => {
  const shuffledDeck = [...deck];
  for (let i = shuffledDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
  }
  return shuffledDeck;
};

const sequenceMapping = (sequenceArray) => {
  const isFlush = sequenceArray.every((card) => card.suit === sequenceArray[0].suit);
  const sortedValues = sequenceArray.map((card) => CARD_VALUES.indexOf(card.value)).sort();
  const isStraight = sortedValues.every((value, i) => i === 0 || value - sortedValues[i - 1] === 1);

  if (isFlush && isStraight && sortedValues[0] === 0 && sortedValues[4] === 12) {
    return "Royal Flush";
  }
  if (isFlush && isStraight) {
    return "Straight Flush";
  }
  const counts = sequenceArray.map((card) => card.value).reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const hasFourOfKind = Object.values(counts).includes(4);
  const hasFullHouse = Object.values(counts).includes(3) && Object.values(counts).includes(2);
  const hasThreeOfKind = Object.values(counts).includes(3);
  const hasTwoPair = Object.values(counts).filter((count) => count === 2).length >= 2;
  const hasPair = Object.values(counts).includes(2);

  if (hasFourOfKind) {
    return "Four of a Kind";
  }
  if (hasFullHouse) {
    return "Full House";
  }
  if (isFlush) {
    return "Flush";
  }
  if (isStraight) {
    return "Straight";
  }
  if (hasThreeOfKind) {
    return "Three of a Kind";
  }
  if (hasTwoPair) {
    return "Two Pairs";
  }
  if (hasPair) {
    return "One Pair";
  }
  return "No Sequence";
};



const Deck = () => {
  const [deckVisible, setDeckVisible] = useState(false);
  const [ethAmount, setEthAmount] = useState("");

  const [deck, setDeck] = useState(() => {
    const deck = [];
    CARD_SUITS.forEach((suit) => {
      CARD_VALUES.forEach((value) => {
        deck.push(CardObject(suit, value));
      });
    });
    return shuffle(deck);
  });

  const sequenceArray = deck.slice(0, 5);
  const [betButtonVisible, setBetButtonVisible] = useState(false);
  const [ethAmountVisible, setEthAmountVisible] = useState(true);
  const [commitChoice, setCommitChoice] = useState<string | undefined>(undefined);
  const [commitSalt, setCommitSalt] = useState<string>("");


  const { writeAsync: cMmit } = useScaffoldContractWrite({
    contractName: "zeroxPoker",
    functionName: "commit",
    args: [commitChoice, commitSalt],
    value: parseEther(ethAmount),
    onBlockConfirmation: txnReceipt => {
      console.log("📦 Transaction blockHash", txnReceipt.blockHash);
    },
  });

  const commit = async () => {
    if (!commitChoice) {
      notification["warning"]({
        message: "No bet placed",
        description: "Please place a bet",
      });
      return;
    }
    if (commitSalt.length === 0) {
      notification["warning"]({
        message: "No password set",
        description: "Please set a password for your commit",
      });
      return;
    }
    await cMmit();
  
    // const result = await tx(writeContracts.zeroxPoker.commit(commitChoice, commitSalt), txnUpdate);
  };

  const toggleDeckVisibility = () => {
    setDeckVisible(!deckVisible);
    setBetButtonVisible(false);
    setEthAmountVisible(false);
    setCommitChoice(sequenceMapping(sequenceArray));

    // setDeck(shuffle(deck)); ***Secret***: If this is toggled the player can shuffle the deck until he gets a good hand 😜
  };


      return (
        <div className="deck">
        <div className="flex items-center flex-col flex-grow pt-10">
          {ethAmountVisible && (
            <EtherInput
              value={ethAmount}
              onChange={amount => {
                setEthAmount(amount);
                if (amount !== '') {
                  setBetButtonVisible(true);
                }
              }}
              placeholder="Input your bet"
            />
          )}
          {betButtonVisible && (
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={toggleDeckVisibility} type="button">
              Bet
            </button>
          )}
        </div>
        {deckVisible && (
          <>
            <div className="flex items-center flex-row flex-grow pt-10">
              {sequenceArray.map((card, index) => (
                <Card key={index} suit={card.suit} value={card.value} />
              ))}
            </div>
          </>
        )}
          <div className="flex items-center flex-col flex-grow pt-10">
              <p>Hand type: {commitChoice}</p>
            </div>
            <h3 style={{ marginTop: "16px" }}
                  >{`Password to reveal your choice later`}</h3>
                  <InputBase
                    placeholder="Password"
                    style={{ textAlign: "center", width: "200px" }}
                    onChange={setCommitSalt}
                    maxLength={15}
                  />
                  <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={commit}>
                    Commit
                  </button>
      </div>
      );
    };
  


export default Deck;