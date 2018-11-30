const Web3 = require('web3'); // web 1.0.0
const Caver = require('caver-js');
const console = require('console');
var fs = require('fs');
var readlineSync = require('readline-sync');
var etherWallet = require('ethereumjs-wallet');

// Common functions
const importFromKeystore = (keystoreFilePath) => {
    const keystoreFilePathExists = fs.existsSync(keystoreFilePath); // check if keystore file exists
    console.log('Keystore file \'' + keystoreFilePath + '\'');
    if (keystoreFilePathExists) {
        var keystorePassword = readlineSync.question(' password: ', { hideEchoBack: true });
        console.log('');

        var keystore = fs.readFileSync(keystoreFilePath).toString();
        try {
            var wallet = etherWallet.fromV3(keystore, keystorePassword);
            return [wallet.getAddressString(), wallet.getPrivateKeyString()]; // private key format : '0x.....'
        } catch (exception) { // error
            if (exception.message == 'Key derivation failed - possibly wrong passphrase') { // wrong keystore file password
                throw 'Wrong keystore password.';
            } else { // unknown error
                console.log(exception);
            }
        }
    } else {// if not, error occurs
        throw 'File not exists.';
    }
}

const webInstances = (networks, networkName) => {
    switch (networkName) {
        case 'local':
            var web3 = new Web3(networks[networkName].url);
            var web3_eth = web3.eth;
            break;
        case 'ropsten':
            var web3 = new Web3(networks[networkName].url);
            var web3_eth = web3.eth;
            break;
        case 'klaytn':
            var web3 = new Caver(networks[networkName].url);
            var web3_eth = web3.klay;
            break;
        default:
            console.log('Wrong networkname: ' + networkName);
            process.exit(-1);
    }
    var gasPrice = networks[networkName].gasPrice;
    var gasLimit = networks[networkName].gas;

    return [web3, web3_eth, gasPrice, gasLimit];
}

const createContractInstance = async (buildFilePath, contractAddress) => {
    const contractBuildJson = require(buildFilePath);

    const contract = new web3_eth.Contract(contractBuildJson.abi);
    contract.options.gasPrice = gasPrice;
    contract.options.gas = gasLimit;
    contract.options.address = contractAddress;

    return contract;
}


// Envirionments
const networks = {
    local: { url: 'ws://localhost:8545', gas: 90000000000, gasPrice: '1' },
    klaytn: { url: "ws://192.168.3.102:8552", gas: 20000000, gasPrice: '25000000000' },
    ropsten: { url: 'ws://ropsten.infura.io/H1k68oRrrO6mYsa4jmnC', gas: 5000000, gasPrice: '10000000000' }
}

// Main code
if (process.argv.length != 6) {
    console.log('Wrong arguments.');
    console.log('Usage: $ node ' + process.argv[1].split('/').reverse()[0] + ' <network> <keystore file> <regitry contract> <attester id>');
    process.exit(-1);
}
const [web3, web3_eth, gasPrice, gasLimit] = webInstances(networks, process.argv[2]);
const [adminAddress, adminPrivateKey] = importFromKeystore(process.argv[3]);
web3_eth.accounts.wallet.add(adminPrivateKey); // private key format : '0x.....'
console.log('RayonAdmin is imported: ' + adminAddress);
console.log('');
// console.log('privatekey: ' + privateKey);
const registryContractAddress = process.argv[4];
const kycAttesterId = process.argv[5];

const main = async () => {
    try {
        const admin = web3_eth.accounts.wallet[0].address;

        // create 'Registry' contract
        var registryContract = await createContractInstance('../abi/Registry.json', registryContractAddress);
        console.log('Creating \'Registry\' Contract Instance. ' + registryContract.options.address);

        // create 'KycAttester' contract
        var contractInfo = await registryContract.methods.getRegistryInfo('KycAttester').call({ from: admin });
        const contractName = contractInfo[0];
        const proxyContractAddress = contractInfo[1];
        const interfaceContractAddress = contractInfo[2];
        const contractVersion = contractInfo[3];
        const contractBlockNumber = contractInfo[4];
        const contractUpdatedTime = contractInfo[5];
        console.log('Getting \'' + contractName + '\' Contract info... proxy:' + proxyContractAddress + ', logic: ' + interfaceContractAddress + ', version: ' + contractVersion);
        var kycAttesterContract = await createContractInstance('../abi/' + contractName + '.json', proxyContractAddress);
        console.log('Creating \'' + contractName + '\' Contract(Proxy) Instance. ' + proxyContractAddress);
        console.log('');
        // event: KycAttester.LogKycAttesterAdded
        kycAttesterContract.events.LogKycAttesterAdded({}, function (error, event) {
            if (error) console.error(error);
            else console.log('  - Event: KycAttester.LogKycAttesterAdded, attesterId: ' + event.returnValues.attesterId);
        });


        // Add KycAttester
        console.log('Current KycAttesters: ' + await kycAttesterContract.methods.size().call({ from: admin }));
        console.log('Adding new KycAttester \'' + kycAttesterId + '\' ...');
        var receipt = await kycAttesterContract.methods.add(kycAttesterId, 'RayonKyc').send({ from: admin });
        console.log('Adding new KycAttester \'' + kycAttesterId + '\' ... Done');
        console.log('Current KycAttesters: ' + await kycAttesterContract.methods.size().call({ from: admin }));
    } catch (exception) {
        console.log(exception);
    }

    // exit
    process.exit();
}
main();