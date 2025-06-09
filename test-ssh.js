const net = require('net');

function testSSH(host, port = 22, timeout = 5000) {
    return new Promise((resolve, reject) => {
        console.log(`Testing SSH connection to ${host}:${port}`);
        console.log(`Timeout: ${timeout}ms`);
        console.log('---');
        
        const startTime = Date.now();
        const socket = new net.Socket();
        
        socket.setTimeout(timeout);
        
        socket.connect(port, host, () => {
            const responseTime = Date.now() - startTime;
            console.log(`✅ SUCCESS: Connected to ${host}:${port} in ${responseTime}ms`);
            socket.destroy();
            resolve({ success: true, responseTime });
        });

        socket.on('error', (error) => {
            const responseTime = Date.now() - startTime;
            console.log(`❌ ERROR: Failed to connect to ${host}:${port}`);
            console.log(`   Code: ${error.code}`);
            console.log(`   Message: ${error.message}`);
            console.log(`   Time: ${responseTime}ms`);
            
            if (error.code === 'ECONNREFUSED') {
                console.log(`   This means the host is reachable but no service is listening on port ${port}`);
            } else if (error.code === 'ENOTFOUND') {
                console.log(`   This means the hostname "${host}" could not be resolved`);
            } else if (error.code === 'ETIMEDOUT') {
                console.log(`   This means the connection timed out - host might be down or firewalled`);
            } else if (error.code === 'EHOSTUNREACH') {
                console.log(`   This means the host is unreachable (routing issue)`);
            }
            
            resolve({ success: false, error: error.code, message: error.message, responseTime });
        });

        socket.on('timeout', () => {
            console.log(`⏰ TIMEOUT: Connection to ${host}:${port} timed out after ${timeout}ms`);
            socket.destroy();
            resolve({ success: false, error: 'TIMEOUT', message: 'Connection timeout', responseTime: timeout });
        });
    });
}

async function runTests() {
    console.log('SSH Connection Test');
    console.log('==================');
    
    // Test various hosts
    const tests = [
        { host: 'atlas.local', port: 22 },
        { host: 'localhost', port: 22 },
        { host: 'github.com', port: 22 },  // Should work as reference
        { host: 'atlas.local', port: 80 },  // Test if atlas.local is reachable at all
    ];
    
    for (const test of tests) {
        console.log(`\nTesting ${test.host}:${test.port}:`);
        await testSSH(test.host, test.port);
        console.log('---');
    }
    
    console.log('\nTesting complete!');
    console.log('\nTroubleshooting tips:');
    console.log('1. Try: ping atlas.local');
    console.log('2. Try: nslookup atlas.local');
    console.log('3. Try: telnet atlas.local 22');
    console.log('4. Check if SSH is running on atlas.local');
    console.log('5. Check firewall settings');
}

runTests().catch(console.error); 