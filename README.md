# Discord Channel Monitor Bot

A Discord bot that monitors specified channels and forwards messages to a designated channel. Perfect for creating logs or maintaining chat archives.

## Features

- Monitor multiple source channels simultaneously
- Forward messages to a designated channel
- Admin-only setup command
- Persistent configuration
- Real-time message monitoring

## Prerequisites

- Node.js v16.9.0 or higher
- Discord Bot Token
- Administrator permissions in your Discord server

## Installation

1. Clone this repository or download the files
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Discord bot token:
```properties
DISCORD_TOKEN=your_bot_token_here
```

## Setup

1. Invite the bot to your server with the following permissions:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History

2. Run the bot:
```bash
npm start
```

3. In Discord, use the following command to configure the bot:
```
!setup
```

## Configuration

The `!setup` command will guide you through:
1. Selecting channels to monitor (mention them in a single message)
2. Choosing a destination channel for forwarded messages

Only server administrators can use the setup command.

## Message Format

Forwarded messages will appear in this format:
```
**Channel:** #source-channel
**User:** username
**Message:** message content
```

## Files

- `index.js`: Main bot code
- `config.json`: Stores channel configurations
- `.env`: Environment variables
- `package.json`: Project dependencies

## Error Handling

- The bot will maintain the previous configuration if setup is cancelled
- Invalid channel mentions will be ignored
- Only text channels can be monitored

## Security

- Only administrators can configure the bot
- Bot token is stored securely in `.env` file
- Configuration is saved locally in `config.json`

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.