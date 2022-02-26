const crypto = require('crypto');
const uuid = require('uuid');

/**
 * Block represents a block in the blockchain. It has the
 * following params:
 * @index represents its position in the blockchain
 * @timestamp shows when it was created
 * @transactions represents the data about transactions
 * added to the chain
 * @prevHash represents the hash of the previous block
 * @hash represents the hash of the block
 * @nonce represents the nonce of the block
 * @merkleRoot represents the merkleRoot of the block
 */
class Block {
    constructor(index, transactions, prevHash, nonce, hash, merkleRoot) {
        this.index = index;
        this.timestamp = Math.floor(Date.now() / 1000);
        this.transactions = transactions;
        this.prevHash = prevHash;
        this.hash = hash;
        this.nonce = nonce;
        this.merkleroot = merkleRoot;
    }
}

/**
 * A blockchain transaction. Has an amount, sender and a
 * recipient (not UTXO).
 */
class Transaction {
    constructor(amount, sender, recipient) {
        this.amount = amount;
        this.sender = sender;
        this.recipient = recipient;
        this.tx_id = uuid().split('-').join();
    }
}

/**
 * Blockchain represents the entire blockchain with the
 * ability to create transactions, mine and validate
 * all blocks.
 * following params:
 * @blockHashRate is used to store hashrate in kH/s for each block, 0 for genesis block
 */
class Blockchain {
    constructor() {
        this.chain = [];
        this.pendingTransactions = [];
        this.addBlock('0');
        this.blockHashRate = [0];
    }

    /**
     * Creates a transaction on the blockchain
     */
    createTransaction(amount, sender, recipient) {
        this.pendingTransactions.push(new Transaction(amount, sender, recipient));
    }

    /**
     * Add a block to the blockchain
     */
    async addBlock(nonce, merkleRootReturned) {
        let index = this.chain.length;
        let prevHash = this.chain.length !== 0 ? this.chain[this.chain.length - 1].hash : '0';
        let merkleRoot = merkleRootReturned ?? "";
        let hash = this.getHash(prevHash, merkleRoot, nonce);
        let block = new Block(index, this.pendingTransactions, prevHash, nonce, hash, merkleRoot );

        // reset pending txs
        this.pendingTransactions = [];
        this.chain.push(block);
    }

    /**
     * Gets the hash of a block.
     */
    getHash(prevHash, merkleRoot, nonce) {
        var encrypt = prevHash + nonce + merkleRoot;        
        var hash=crypto.createHmac('sha256', "supersecret")
            .update(encrypt)
            .digest('hex');
        return hash;
    }

    /**
     * Gets the merkle hash. Used to generate hash for all nodes except leaf nodes. Employs a different secret key
     */    
    getNonLeafNodeHash(inputHash){        
        var hash=crypto.createHmac('sha256', "deepsecret")
            .update(inputHash)
            .digest('hex');        
        return hash;
    }

    /**
     * Gets the hash of transactions in a block. Used to generate hash for leaf nodes. Employs a different secret key
     */    
    getLeafNodeHash(transaction) {        
        var hash=crypto.createHmac('sha256', "secret")
            .update(transaction.tx_id)
            .digest('hex');        
        return hash;
    }

    /**
     * Generate a random nonce string
     * * following params:
     * @randomNonce the nonce generated randomly
     * @allowedCharacters characters allowed in the nonce
     * @charactersLength total length of @allowedCharacters
     */
    generateRandomNonce(nonceLength) {
        var randomNonce = '';
        var allowedCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = allowedCharacters.length;
        for ( var i = 0; i <nonceLength; i++ ) {
            randomNonce += allowedCharacters.charAt(Math.floor(Math.random() * 
            charactersLength));
        }
        return randomNonce;
    }
    
    /**
     * Set difficulty based on the total number of blocks
     * following params:
     * @incrementFactor adjusts the difficulty of the blockchain, higher number lowers difficulty
     * @difficulty the calculated difficulty
     */
    setDifficulty() {
        let incrementFactor = 2;
        let difficulty = Math.floor((this.chain.length/incrementFactor) + 1);
        return difficulty;
    }

    /**
     * Set comparison string based on difficulty - 0, 00, 000, 0000, and so on...
     * following params:
     * @comparisonString the comparison string chosen for comparing the hash
     */
    setComparisonString(difficulty) {
        let comparisonString = "";
        for (var i = 1; i <= difficulty; i++ ) {
            comparisonString += "0";
        }
        return comparisonString;
    }

    /**
     * Recursively calculate merkle tree for a block
     * following params:
     * @treeNodes defines the number of leafnodes for a parent node in the merkle tree
     * @nextTransactionNumber represents the transaction number being iterated
     * @merkleRoot represents the merkleRoot calculated for the block
     */
    async calculateMerkleTreeRecursively(pendingTransactions, nextTransaction, prevMerkleRootCurrentBlock){
                
        let treeNodes = 2; // 2 for binary merkle tree, n for n-ary merkle tree     

        let nextTransactionNumber = nextTransaction ?? 0; 
        let merkleRoot = prevMerkleRootCurrentBlock ?? "";
        
        // If no transactions in a block
        if (pendingTransactions.length == 0){          

            merkleRoot = "";
            
        }else if(pendingTransactions[nextTransactionNumber+1]){ // If this is not the last transaction

            let subTreeHash = "";            
            // Calculate hash of subtree based on treeNodes param
            for( var i=0; i<treeNodes; i++){
                if(pendingTransactions[nextTransactionNumber+i]){
                    subTreeHash += await this.getLeafNodeHash(pendingTransactions[nextTransactionNumber+i])                    
                }              
            }
            merkleRoot += (await this.getNonLeafNodeHash(subTreeHash));            
            if(nextTransactionNumber > 0)
            {
                merkleRoot = await this.getNonLeafNodeHash(merkleRoot);
            }

        }else{ // If this is the last or only transaction
            
            merkleRoot += await this.getLeafNodeHash(pendingTransactions[nextTransactionNumber]);
            if(nextTransactionNumber > 0)
            {
                merkleRoot = await this.getNonLeafNodeHash(merkleRoot);
            }
        }
        
        nextTransactionNumber += treeNodes;        
        
        // Calls the function recursively untill there are no more transactions
        if(pendingTransactions[nextTransactionNumber]){
            return await this.calculateMerkleTreeRecursively(pendingTransactions, nextTransactionNumber, merkleRoot)
        }else{            
            return merkleRoot;
        }
        
    }

    /**
     * Find nonce that satisfies the proof of work
     * following params:
     * @numberOfCalculatedHashes total number of hashes calculated for each block mined to meet the proofOfWork condition
     * @timeTaken total time taken to achieve the desired hash
     * @genNonce the random nonce generated, a length of 10 is used
     */
    proofOfWork(merkleRoot) {
        
        let prevHash = this.chain.length !== 0 ? this.chain[this.chain.length - 1].hash : '0';
        let difficulty = this.setDifficulty();
        let comparisonString = this.setComparisonString(difficulty);
                
        var numberOfCalculatedHashes = 0;
        var timeStart = performance.now();
        
        // Calculate a nonce that satisfies the specified comparisonString condition
        for ( var i = 1; i > 0; i++ ) {
            
            var genNonce = this.generateRandomNonce(10);
            
            var nextHash = this.getHash(prevHash, merkleRoot, genNonce);
            numberOfCalculatedHashes ++;
            
            // If hash meets the comparison substring condition
            if( nextHash.substring(0,difficulty) == comparisonString ) {
                var timeEnd = performance.now();
                var timeTaken = (timeEnd - timeStart)/1000; // Convert to seconds
                this.blockHashRate.push(parseFloat((numberOfCalculatedHashes/(timeTaken * 1000)).toFixed(3))); // Divided by 1000 as converting to kH/s
                return genNonce;
            }
        }
    }

    /**
     * Mine a block and add it to the chain.
     */
    async mine() {
        let tx_id_list = [];
        this.pendingTransactions.forEach((tx) => tx_id_list.push(tx.tx_id));                
        let merkleRoot = await this.calculateMerkleTreeRecursively(this.pendingTransactions);
        let nonce = this.proofOfWork(merkleRoot);
        this.addBlock(nonce, merkleRoot); 
    }    

    /**
     * Calculate average hash rate
     * following params:
     * @sumHashRate sum of all hash rates, except genesis block
     * @avgHashRate the average of all hash rates, except genesis block
     */
    calculateAverageHashRate() {
        let avgHashRate = 0;
        let sumHashRate = 0;
        for( var i = 1; i < this.blockHashRate.length; i++) {
            sumHashRate += this.blockHashRate[i];
        }
        avgHashRate = sumHashRate/(this.blockHashRate.length - 1);
        return avgHashRate;
    }

    /**
     * Check if the chain is valid by going through all blocks and comparing their stored
     * hash with the computed hash.
     */
    chainIsValid(){
        for(var i=0;i<this.chain.length;i++){            

            if(i == 0 && this.chain[i].hash !==this.getHash('0','','0')){                
                return false;
            }
            if(i > 0 && this.chain[i].hash !== this.getHash(this.chain[i-1].hash, this.chain[i].merkleroot, this.chain[i].nonce)){
                return false;
            }
            if(i > 0 && this.chain[i].prevHash !== this.chain[i-1].hash){                
                return false;
            }
        }
        return true;
    }    
}

function simulateChain(blockchain, numTxs, numBlocks) {
    for(let i = 0; i < numBlocks; i++) {
        let numTxsRand = Math.floor(Math.random() * Math.floor(numTxs));
        for(let j = 0; j < numTxsRand; j++) {
            let sender = uuid().substr(0,5);
            let receiver = uuid().substr(0,5);
            blockchain.createTransaction(sender, receiver,
                                         Math.floor(Math.random() * Math.floor(1000)));
        }
        blockchain.mine();
    }
}

//const BChain = new Blockchain();
//simulateChain(BChain, 5, 3);

module.exports = Blockchain;
// console.dir(BChain,{depth:null});

// console.log("******** Validity of this blockchain: ", BChain.chainIsValid());
