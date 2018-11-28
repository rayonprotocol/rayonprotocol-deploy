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

const deployContract = async (buildFilePath, args, sender) => {
    const contractBuildJson = require(buildFilePath);

    const contract = new web3_eth.Contract(contractBuildJson.abi);
    contract.options.gasPrice = gasPrice;
    contract.options.gas = gasLimit;

    const deployMethod = contract.deploy({
        data: contractBuildJson.bytecode,
        arguments: args
    });

    // deploy contract
    let receipt;
    await deployMethod.send({ from: sender }).on('receipt', function (returns) {
        receipt = returns;
    });

    contract.options.address = receipt.contractAddress;
    return [contract, receipt];
}

const deployProxy = async (contractName, sender) => {
    return await deployContract(proxyDeployInfo.buildFilePath, [contractName], sender);
}

const createContract = async (buildFilePath, contractAddress) => {
    const contractBuildJson = require(buildFilePath);

    const contract = new web3_eth.Contract(contractBuildJson.abi);
    contract.options.gasPrice = gasPrice;
    contract.options.gas = gasLimit;
    contract.options.address = contractAddress;

    return contract;
}

const copyBuildFile = (contractName, srcFilePath) => {
    const abiDir = '../abi';
    if (!fs.existsSync(abiDir)) {
        fs.mkdirSync(abiDir);
    }
    const dstPath = abiDir + '/' + contractName + '.json';
    fs.copyFileSync(srcFilePath, dstPath);
    console.log('Copy \'' + contractName + '.json\' file to \'' + dstPath + '\'');
}

const printContractInfoFromRegistry = async (registryContract, sender) => {
    // print contract info
    console.log('Registry Contract: ' + registryContract.options.address);
    const contractCount = await registryContract.methods.size().call({ from: sender });
    console.log('Contracts: ' + contractCount);
    console.log(' | ' + 'Name' + '\t\t\t' + 'ProxyContract' + '\t\t\t\t\t' + 'LogicContract' + '\t\t\t\t\t' + 'Version' + '\t' + 'BlockNumber' + '\t' + 'UpdatedTime');
    console.log(' -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------');
    for (i = 0; i < contractCount; i++) {
        var contractInfo = await registryContract.methods.getRegistryInfoByIndex(i).call({ from: sender });
        const contractName = contractInfo[0];
        const proxyContractAddress = contractInfo[1];
        const interfaceContractAddress = contractInfo[2];
        const contractVersion = contractInfo[3];
        const contractBlockNumber = contractInfo[4];
        const contractUpdatedTime = contractInfo[5];
        console.log(' | ' + contractName + '\t' + (contractName.length < 5 ? '\t' : '') + (contractName.length < 13 ? '\t' : '') + proxyContractAddress + '\t' + interfaceContractAddress + '\t' + contractVersion + '\t' + contractBlockNumber + '\t\t' + new Date(contractUpdatedTime * 1000).toISOString());
    }
}


// Envirionments
const networks = {
    local: { url: 'http://localhost:8545', gas: 90000000000, gasPrice: '1' },
    klaytn: { url: "http://192.168.3.102:8551", gas: 20000000, gasPrice: '25000000000' },
    ropsten: { url: 'https://ropsten.infura.io/H1k68oRrrO6mYsa4jmnC', gas: 5000000, gasPrice: '10000000000' }
}

const registryDeployInfo = { name: 'Registry', buildFilePath: '../../rayonprotocol-contract-registry/build/contracts/Registry.json', args: [1] }
const proxyDeployInfo = { name: 'RayonProxy', buildFilePath: '../../rayonprotocol-contract-common/build/contracts/RayonProxy.json', args: [] }
const contractDeployInfos = [
    { name: 'KycAttester', buildFilePath: '../../rayonprotocol-contract-kyc/build/contracts/KycAttester.json', args: [1] },
    { name: 'Auth', buildFilePath: '../../rayonprotocol-contract-kyc/build/contracts/Auth.json', args: [1] },
    { name: 'BorrowerApp', buildFilePath: '../../rayonprotocol-contract-borrower/build/contracts/BorrowerApp.json', args: [1] },
    { name: 'Borrower', buildFilePath: '../../rayonprotocol-contract-borrower/build/contracts/Borrower.json', args: [1] },
    { name: 'BorrowerMember', buildFilePath: '../../rayonprotocol-contract-borrower/build/contracts/BorrowerMember.json', args: [1] },
    { name: 'PersonalDataCategory', buildFilePath: '../../rayonprotocol-contract-personaldata/build/contracts/PersonalDataCategory.json', args: [1] },
    { name: 'PersonalDataList', buildFilePath: '../../rayonprotocol-contract-personaldata/build/contracts/PersonalDataList.json', args: [1] }
]

// Main code
if (process.argv.length != 4) {
    console.log('Wrong arguments.');
    console.log('Usage: $ node ' + process.argv[1].split('/').reverse()[0] + ' <network> <keystore file>');
    process.exit(-1);
}
const [web3, web3_eth, gasPrice, gasLimit] = webInstances(networks, process.argv[2]);
const [adminAddress, adminPrivateKey] = importFromKeystore(process.argv[3]);
web3_eth.accounts.wallet.add(adminPrivateKey); // private key format : '0x.....'
console.log('RayonAdmin is imported: ' + adminAddress);
console.log('');
// console.log('privatekey: ' + privateKey);

const main = async () => {
    try {
        const admin = web3_eth.accounts.wallet[0].address;

        // deploy 'Registry' contract
        console.log('Deloying \'Registry\' Contract ...');
        var [registryContract, receipt] = await deployContract(registryDeployInfo.buildFilePath, registryDeployInfo.args, admin);
        console.log('Deloying \'Registry\' Contract ... Done. ' + registryContract.options.address);

        // copy buildfile to 'abi' directory
        copyBuildFile(registryDeployInfo.name, registryDeployInfo.buildFilePath);

        // rayon contracts (proxy + logic)
        for (i = 0; i < contractDeployInfos.length; i++) {
            // console.log('name: ' + contractDeployInfos[i].name + ', buildFilePath: ' + contractDeployInfos[i].buildFilePath);

            // deploy proxy contract
            console.log('Deloying \'RayonProxy\' Contract for \'' + contractDeployInfos[i].name + '\' ...');
            var [proxyContract, receipt] = await deployProxy(contractDeployInfos[i].name, admin);
            var proxyContractBlockNumber = receipt.blockNumber;
            console.log('Deloying \'RayonProxy\' Contract for \'' + contractDeployInfos[i].name + '\' ... Done. ' + proxyContract.options.address);

            // Registry.register()
            var receipt = await registryContract.methods.register(proxyContract.options.address, proxyContractBlockNumber).send({ from: admin });

            // deploy logic contract
            console.log('Deloying \'' + contractDeployInfos[i].name + '\' Contract for logic ...');
            var [logicContract, receipt] = await deployContract(contractDeployInfos[i].buildFilePath, contractDeployInfos[i].args, admin);
            console.log('Deloying \'' + contractDeployInfos[i].name + '\' Contract for logic ... Done. ' + logicContract.options.address);

            // proxy.setTargetAddress(logic) 
            var receipt = await proxyContract.methods.setTargetAddress(logicContract.options.address).send({ from: admin });

            // Registry.upgrade()
            var receipt = await registryContract.methods.upgrade(logicContract.options.address).send({ from: admin });

            // copy buildfile to 'abi' directory
            copyBuildFile(contractDeployInfos[i].name, contractDeployInfos[i].buildFilePath);
        }

        console.log('');
        console.log('Result Information');
        console.log('');
        await printContractInfoFromRegistry(registryContract, admin);
    } catch (exception) {
        console.log(exception);
    }

    // exit
    process.exit();
}
main();