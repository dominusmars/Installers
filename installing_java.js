const os = require("os");
const path = require("path");
const request = require("request");
const chp = require("node:child_process");
const { execSync, exec } = require("child_process")
const fs = require("fs");
const AdmZip = require("adm-zip");
const delay = require('delay')
const progress = require('progress-stream')
var platform = os.platform();

var downloadPath = path.join(os.homedir(), "Downloads");
var windowURL =
    "https://dl.dropboxusercontent.com/s/mq1qn55tkdatwak/jdk-8u351-windows-x64.zip?dl=0";

const isRunning = async (query) => {
    let platform = process.platform;
    let cmd = '';
    switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${query}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
    }
    var c = execSync(cmd);
    return c.toString().toLowerCase().indexOf(query.toLowerCase()) > -1
}
function SetUpStream(filename) {
    var stat = fs.statSync(filename);
    var str = progress({
        length: stat.size,
        time: 100 /* ms */
    });
    str.on('progress', (progr) => {
        process.stdout.write("\r\x1b[K")

        var displayString = `Transferred: ${progr.transferred} | DownloadSpeed: ${progr.speed.toFixed(2)} | Runtime: ${progr.runtime}`
        process.stdout.write(displayString)
    })
    return str
}


async function installDarwin() {
    console.log("Installing HoneyBrew!")
    var child = chp.exec(`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)
    child.stdout.pipe(process.stdout)
    child.stdin.pipe(process.stdin)

    child.on("error", (e) => {
        console.log(e)
    })
    child.on('close', async () => {
        console.log("Installed HoneyBrew")
        console.log("Installing OpenJDK")
        var child = chp.exec(`brew tap adoptopenjdk/openjdk ; brew install --cask adoptopenjdk8 ;`)
        child.stdout.pipe(process.stdout)
        child.stdin.pipe(process.stdin)
        child.on("error", (e) => {
            console.log(e)
        })
        child.on('close', async () => {
            console.log("java successfully installed")
        })

    })
}
async function installWins() {
    const nw = require("node-windows");
    var zipName = "jdk-8u351-windows-x64.zip";
    var binaryPath = path.join(downloadPath, zipName);
    var windowsJavaDir = path.join("C:", "Program Files", "Java")
    var tempJavaDir = path.join(downloadPath, "java")
    console.log("Downloading Zip")
    var str = SetUpStream(binaryPath)

    request(windowURL)
        .pipe(str)
        .pipe(fs.createWriteStream(binaryPath))
        .on("close", function () {
            console.log("File written!");
            var zip = new AdmZip(binaryPath);
            zip.extractAllTo(tempJavaDir);
            console.log("Unzipped!");
            var files = fs.readdirSync(tempJavaDir);
            nw.elevate(path.join(tempJavaDir, files[0]) + ` /s ADDLOCAL="ToolsFeature,SourceFeature,PublicjreFeature"`, async (e) => {
                console.log("Installing Java")
                while (await isRunning('jdk')) {
                    console.log("waiting for java installer")
                    await delay(1000);
                }
                if (!fs.existsSync(windowsJavaDir)) {
                    console.log("Unsuccessful Install Please try again!")
                    try {
                        fs.rmSync(tempJavaDir, {
                            'recursive': true
                        })
                        fs.rmSync(binaryPath, {
                            'recursive': true
                        })

                    } catch (error) {
                        console.log(error)
                    }
                    return;
                }
                console.log("Java installed Successfully")
                nw.elevate("rundll32 sysdm.cpl,EditEnvironmentVariables", () => {

                    var javafolders = fs.readdirSync(windowsJavaDir)
                    var jdkFolder = javafolders.find((v) => {
                        return v.includes("jdk")
                    })
                    if (!jdkFolder) {
                        return console.log("Unable to locate JDK")
                    }
                    console.log(`\nPlease Add The Following to your Environment Varible\n\n${windowsJavaDir}/${jdkFolder}/bin\n`)
                    console.log("Once done, java and javac should work right from the command prompt")
                    try {
                        fs.rmSync(tempJavaDir, {
                            'recursive': true
                        })
                        fs.rmSync(binaryPath, {
                            'recursive': true
                        })
                    } catch (error) {

                    }

                })
            })
        });
}
async function installLinux() {
    var child = chp.exec('sudo apt-get install openjdk-8-jdk')
    child.stdout.pipe(process.stdout)
    child.stdin.pipe(process.stdin)
}


switch (platform) {
    case "darwin":
        installDarwin()
        break;
    case "win32":
        installWins()
        break;
    case "linux":
        installLinux()
        break;
    default:
        console.log("unknown platform " + platform);
        break;
}
