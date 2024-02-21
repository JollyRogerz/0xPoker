"use client";

import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  suit: string;
  value: string;
}

const Card: React.FC<CardProps> = ({ suit, value }) => {
    const colorClass = suit === '♠' || suit === '♣' ? styles.black : styles.red;
  
    return (
      <div className={`${styles.card} ${colorClass}`} data-value={`${value} ${suit}`}>
        <span className={styles.suit}>{suit}</span>
        <span className={styles.value}>{value}</span>
      </div>
    );
  };

export default Card;



