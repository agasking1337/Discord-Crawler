require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Load configuration from file
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const jsonConfig = JSON.parse(data);
            return {
                sourceChannels: new Set(jsonConfig.sourceChannels || []),
                destinationChannel: jsonConfig.destinationChannel || null
            };
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
    return {
        sourceChannels: new Set(),
        destinationChannel: null
    };
}

// Save configuration to file
function saveConfig(config) {
    try {
        const jsonConfig = {
            sourceChannels: Array.from(config.sourceChannels),
            destinationChannel: config.destinationChannel
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(jsonConfig, null, 2));
        console.log('Configuration saved:', jsonConfig);
        return true;  // Added return value to indicate success
    } catch (error) {
        console.error('Error saving config:', error);
        return false;  // Added return value to indicate failure
    }
}

// Create a backup of the current configuration
function backupConfig(config) {
    if (!config || !(config.sourceChannels instanceof Set)) {
        console.error('Invalid config format for backup');
        return {
            sourceChannels: new Set(),
            destinationChannel: null
        };
    }
    
    return {
        sourceChannels: new Set(config.sourceChannels),
        destinationChannel: config.destinationChannel
    };
}

// Initialize config from file
let config = loadConfig();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Check if message.member is available
    if (!message.guild || !message.member) {
        return message.reply('Could not retrieve member information.');
    }

    if (message.content.toLowerCase() === '!setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            message.reply('You need administrator permissions to run this command.');
            return;
        }

        // Show current setup if exists
        if (config.sourceChannels.size > 0 || config.destinationChannel) {
            let currentSetup = 'Current Setup:\n';
            if (config.sourceChannels.size > 0) {
                currentSetup += 'Monitored channels:\n';
                config.sourceChannels.forEach(channelId => {
                    const channel = client.channels.cache.get(channelId);
                    if (channel) {
                        currentSetup += `- #${channel.name}\n`;
                    }
                });
            }
            if (config.destinationChannel) {
                const destChannel = client.channels.cache.get(config.destinationChannel);
                if (destChannel) {
                    currentSetup += `\nDestination channel: #${destChannel.name}`;
                }
            }
            await message.channel.send(currentSetup);
            await message.channel.send('Starting new setup...');
        }

        // Backup current configuration
        const oldConfig = backupConfig(config);
        console.log('Configuration backed up before setup');

        // List all available text channels
        let channelList = '📋 **Available Text Channels:**\n';
        message.guild.channels.cache
            .filter(channel => channel.type === ChannelType.GuildText)
            .forEach(channel => {
                channelList += `• #${channel.name} (${channel.id})\n`;
            });

        await message.channel.send(channelList);
        
        const setupMessage = await message.channel.send('🔧 **Setup Step 1/2:**\nPlease mention all the channels you want to monitor (mention them in a single message, separated by spaces)\n*Setup will timeout in 30 seconds*');

        // Create message collector for source channels with timeout
        const sourceCollector = message.channel.createMessageCollector({
            filter: m => m.author.id === message.author.id,
            max: 1,
            time: 30000  // 30 seconds timeout
        });

        sourceCollector.on('collect', async collected => {
            const mentionedChannels = collected.mentions.channels;
            
            if (mentionedChannels.size === 0) {
                message.channel.send('No channels were mentioned. Setup cancelled. Previous configuration restored.');
                config = oldConfig;  // Restore old config
                saveConfig(config);  // Save the restored config
                return;
            }

            mentionedChannels.forEach(channel => {
                if (channel.type === ChannelType.GuildText) {
                    config.sourceChannels.add(channel.id);
                }
            });

            let selectedChannels = 'Selected channels to monitor:\n';
            mentionedChannels.forEach(channel => {
                selectedChannels += `#${channel.name}\n`;
            });
            await message.channel.send(selectedChannels);

            const destMessage = await message.channel.send('🔧 **Setup Step 2/2:**\nPlease mention the channel where you want the messages to be sent\n*Setup will timeout in 30 seconds*');

            // Create message collector for destination channel with timeout
            const destCollector = message.channel.createMessageCollector({
                filter: m => m.author.id === message.author.id,
                max: 1,
                time: 30000  // 30 seconds timeout
            });

            destCollector.on('collect', async destCollected => {
                const destChannel = destCollected.mentions.channels.first();
                
                if (!destChannel) {
                    message.channel.send('No destination channel mentioned. Setup cancelled. Previous configuration restored.');
                    config = oldConfig;  // Restore old config
                    saveConfig(config);  // Save the restored config
                    return;
                }

                config.destinationChannel = destChannel.id;
                
                if (saveConfig(config)) {
                    await message.channel.send(`✅ **Setup Complete!**\n• Monitoring ${config.sourceChannels.size} channels\n• Sending messages to: #${destChannel.name}\n• Configuration has been saved`);
                } else {
                    config = oldConfig;
                    saveConfig(config);
                    await message.channel.send('❌ Error saving configuration. Previous settings restored.');
                }
            });

            // Handle destination channel collector timeout
            destCollector.on('end', collected => {
                if (collected.size === 0) {
                    message.channel.send('Setup timed out. Previous configuration restored.');
                    config = oldConfig;  // Restore old config
                    saveConfig(config);  // Save the restored config
                }
            });
        });

        // Handle source channel collector timeout
        sourceCollector.on('end', collected => {
            if (collected.size === 0) {
                message.channel.send('Setup timed out. Previous configuration restored.');
                config = oldConfig;  // Restore old config
                saveConfig(config);  // Save the restored config
            }
        });
    }

    // Handle monitored channels
    if (config.sourceChannels.has(message.channelId)) {
        console.log('Processing message from monitored channel');
        const userData = {
            username: message.author.username,
            userId: message.author.id,
            message: message.content,
            sourceChannel: message.channel.name,
            timestamp: message.createdAt
        };

        if (config.destinationChannel) {
            const destChannel = client.channels.cache.get(config.destinationChannel);
            if (destChannel) {
                await destChannel.send(`**Channel:** ${userData.sourceChannel}\n**User:** ${userData.username}\n**Message:** ${userData.message}`);
                console.log('Message forwarded to destination channel');
            } else {
                console.log('Destination channel not found:', config.destinationChannel);
            }
        }

        console.log('New message received:', userData);
    }
});

// Add message deletion event handler
client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;
    
    if (config.sourceChannels.has(message.channelId)) {
        const deletionData = {
            username: message.author?.username || 'Unknown User',
            userId: message.author?.id || 'Unknown ID',
            message: message.content || 'Unknown Content',
            sourceChannel: message.channel.name,
            timestamp: new Date()
        };

        if (config.destinationChannel) {
            const destChannel = client.channels.cache.get(config.destinationChannel);
            if (destChannel) {
                destChannel.send(`🗑️ **Message Deleted**\n**Channel:** ${deletionData.sourceChannel}\n**User:** ${deletionData.username}\n**Deleted Message:** ${deletionData.message}`);
            }
        }

        console.log('Message deleted:', deletionData);
    }
});


client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Currently monitoring channels:', Array.from(config.sourceChannels));
    console.log('Destination channel:', config.destinationChannel);
});

client.login(process.env.DISCORD_TOKEN);