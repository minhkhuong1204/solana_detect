require("dotenv").config();
const { Connection, PublicKey, clusterApiUrl } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getMint, getAccount } = require("@solana/spl-token");

// Solana mainnet connection
const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

// Pumpfun program ID (replace with the actual ID if known)
const PUMPFUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// Minimum SOL amount a dev must buy
const MINIMUM_SOL_BUY = 1;


(async () => {
  console.log("Listening for new tokens with specific criteria...");
  connection.onLogs("all", async (log) => {
    try {
      const { logs, transactionSignature } = log;
	
      // Check if logs involve the Pumpfun program
      if (logs.some((log) => log.includes(PUMPFUN_PROGRAM_ID))) {
        // Fetch transaction details
        const tx = await connection.getTransaction(transactionSignature, {
          commitment: "confirmed",
        });

        if (tx && tx.transaction.message.instructions) {
          for (const ix of tx.transaction.message.instructions) {
            // Ensure it's a token creation instruction
            if (ix.programId.toString() === TOKEN_PROGRAM_ID.toString()) {
              console.log("\n🚀 New Token Detected!");
              console.log(`Transaction Signature: ${transactionSignature}`);

              const mintAddress = ix.keys[0].pubkey.toString();
              console.log(`Mint Address: ${mintAddress}`);

              // Fetch mint details
              const mintInfo = await getMint(connection, new PublicKey(mintAddress));

              // Check if the token name contains "AI" (using metadata)
              const tokenName = await getTokenName(mintAddress); // Implement `getTokenName` below
              if (!tokenName || !tokenName.includes("AI")) {
                console.log(`Token ${mintAddress} does not match the name criteria.`);
                continue;
              }

              // Check if the token is frozen or tradable
              const accountInfo = await getAccount(connection, mintInfo.mintAuthority);
              if (accountInfo.isFrozen) {
                console.log(`Token ${mintAddress} is frozen.`);
                continue;
              }

              // Check if the dev has bought at least 1 SOL worth of the token
              const devWallet = mintInfo.mintAuthority.toString();
              const devBuyVolume = await checkDevBuyVolume(devWallet, mintAddress); // Implement `checkDevBuyVolume`
              if (devBuyVolume < MINIMUM_SOL_BUY) {
                console.log(`Dev wallet ${devWallet} has not bought enough tokens.`);
                continue;
              }

              console.log(`✅ Token ${mintAddress} matches all criteria!`);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing transaction:", error);
    }
  });
})();


const { Metadata } = require("@metaplex-foundation/mpl-token-metadata");

async function getTokenName(mintAddress) {
  try {
    const metadataPDA = await Metadata.getPDA(new PublicKey(mintAddress));
    const metadata = await Metadata.load(connection, metadataPDA);
    return metadata.data.name;
  } catch (error) {
    console.error(`Failed to fetch metadata for ${mintAddress}:`, error);
    return null;
  }
}

async function checkDevBuyVolume(walletAddress, tokenMintAddress) {
  try {
    const transactions = await connection.getConfirmedSignaturesForAddress2(
      new PublicKey(walletAddress),
      { limit: 100 }
    );

    let totalVolume = 0;
    for (const tx of transactions) {
      const details = await connection.getParsedTransaction(tx.signature);
      if (details) {
        for (const instruction of details.transaction.message.instructions) {
          if (
            instruction.programId.toString() === TOKEN_PROGRAM_ID.toString() &&
            instruction.data === "transfer" // Check transfer instruction
          ) {
            const tokenAmount = instruction.amount; // Replace with actual parsed value
            totalVolume += tokenAmount;
          }
        }
      }
    }

    return totalVolume / 1e9; // Convert lamports to SOL
  } catch (error) {
    console.error(`Error fetching buy volume for ${walletAddress}:`, error);
    return 0;
  }
}


