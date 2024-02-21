'use client';

import type { NextPage } from "next";
import GameUI from "../components/GameUi";




const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold">0xPoker</span>
            <div className="flex items-center flex-col flex-grow pt-10">
              <GameUI/>
            </div>
          </h1>
          <p className="text-center text-lg">This a Commit and Reveal Poker Game </p>
          <p className="text-center text-lg">Have Fun 😄</p>
        </div>
      </div>
    </>
  );
};
export default Home;

