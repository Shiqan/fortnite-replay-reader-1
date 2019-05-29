const Parser = require('./binary-parser/binary_parser').Parser;
const utils = require('./utils.js');

const ELocalFileChunkType = {
  0: 'Header',
  1: 'ReplayData',
  2: 'Checkpoint',
  3: 'Event',
  0xFFFFFFFF: 'Unknown'
};

const ReplayHeader = new Parser()
  .endianess('little')
  .int32('MagicNumber')
  .int32('FileVersion')
  .int32('LengthInMS')
  .int32('NetworkVersion')
  .int32('Changelist')
  .int32('FriendlyNameSize', {
    formatter: function(int) {
      return int < 0 ? -int*2 : int;
    }
  })
  .string('FriendlyName', {
    length: 'FriendlyNameSize',
    encoding: 'hex',
    stripNull: 'true',
    formatter: function(str) {
      if(/0000$/.test(str)) {
        return new Buffer(str, 'hex').toString('ucs2').replace(/\u0000$/, '');
      }
      return new Buffer(str, 'hex').toString('utf8');
    }
  })
  .int32('IsLive', {
    formatter: function(int) {
      return int != 0;
    }
  })
  .buffer('Timestamp', { length: 8 })
  .int32('Compressed', {
    formatter: function(int) {
      return int != 0;
    }
  });

//https://github.com/EpicGames/UnrealEngine/blob/master/Engine/Source/Runtime/NetworkReplayStreaming/LocalFileNetworkReplayStreaming/Private/LocalFileNetworkReplayStreaming.cpp#L211
const Chunk = new Parser()
  .endianess('little')
  .int32('ChunkType')
  .int32('SizeInBytes')
  .buffer('buffer', { length: 'SizeInBytes' });

const ReplayParser = new Parser()
  .endianess('little')
  .nest('header', {type: ReplayHeader})
  .array('chunks', {
    type: Chunk,
    readUntil: 'eof'
  })

const GameSpecificDataParser = new Parser()
  .endianess('little')
  .uint32('name_length')
  .string('name', {
    length: 'name_length',
    encoding: 'hex',
    stripNull: 'true',
    formatter: function(str) {
      if(/0000$/.test(str)) {
        return new Buffer(str, 'hex').toString('ucs2').replace(/\u0000$/, '');
      }
      return new Buffer(str, 'hex').toString('utf8');
    }
  })

const LevelNamesAndTimesParser = new Parser()
  .endianess('little')
  .uint32('name_length')
  .string('name', {
    length: 'name_length',
    encoding: 'hex',
    stripNull: 'true',
    formatter: function(str) {
      if(/0000$/.test(str)) {
        return new Buffer(str, 'hex').toString('ucs2').replace(/\u0000$/, '');
      }
      return new Buffer(str, 'hex').toString('utf8');
    }
  })
  .uint32('time')

const HeaderChunk = new Parser()
  .endianess('little')
  .uint32('magic')
  .uint32('NetworkVersion')
  .uint32('NetworkChecksum')
  .uint32('EngineNetworkVersion')
  .uint32('GameNetworkProtocalVersion')
  .if('guid', {
    check: 'vars.NetworkVersion >= 12',
    parser: new Parser().string('guid', { length: 16, encoding: 'hex', stripNull: 'true'})
  })
  .uint16('major')
  .uint16('minor')
  .uint16('patch')
  .uint32('changelist')
  .uint32('branch_length')
  .string('branch', {
    length: 'branch_length',
    encoding: 'hex',
    stripNull: 'true',
    formatter: function(str) {
      if(/0000$/.test(str)) {
        return new Buffer(str, 'hex').toString('ucs2').replace(/\u0000$/, '');
      }
      return new Buffer(str, 'hex').toString('utf8');
    }
  })
  .uint32('length')
  .array('LevelNamesAndTimes', {
    type: LevelNamesAndTimesParser,
    length: 'length'
  })
  .if('flags', {
    check: 'vars.NetworkVersion >= 9',
    parser: new Parser().uint32('flags')
  })
  .uint32('length')
  .array('GameSpecificData', {
    type: GameSpecificDataParser,
    length: 'length'
  })

const ReplayDataChunk = new Parser()
  .endianess('little')
  .uint32('time1')
  .uint32('time2')
  .buffer('buffer', { readUntil: 'eof'})

const CheckpointChunk = new Parser()
  .endianess('little')
  .int32('id_length')
  .string('id', { length: 'id_length', stripNull: 'true'})
  .int32('group_length')
  .string('group', { length: 'group_length', stripNull: 'true'})
  .int32('metadata_length')
  .string('metadata', { length: 'metadata_length', stripNull: 'true'})
  .uint32('time1')
  .uint32('time2')
  .uint32('SizeInBytes')

const EventChunk = new Parser()
  .endianess('little')
  .int32('id_length')
  .string('id', { length: 'id_length', stripNull: 'true'})
  .int32('group_length')
  .string('group', { length: 'group_length', stripNull: 'true'})
  .int32('metadata_length')
  .string('metadata', { length: 'metadata_length', stripNull: 'true'})
  .uint32('time1')
  .uint32('time2')
  .uint32('SizeInBytes')
  .buffer('buffer', { readUntil: 'eof'})

// -----

const MatchTeamStats = new Parser()
  .endianess('little')
  .uint32('unknown')
  .uint32('final_ranking')
  .uint32('total_players')

const MatchStats = new Parser()
  .endianess('little')
  .uint32('unknown')
  .float('accuracy')
  .uint32('assists')
  .uint32('total_eliminations')
  .uint32('weapon_damage')
  .uint32('other_damage')
  .uint32('revives')
  .uint32('damage_taken')
  .uint32('damage_to_structures')
  .uint32('materials_gathered')
  .uint32('materials_used')
  .uint32('total_traveled')

// Add support for constructor to pass some parameters to avoid two player elim parsers...
const PlayerElimOld = 
  new Parser()
  .endianess('little')
  .skip(45)
  .int32('a_length', {
    formatter: function(int) {
      return int < 0 ? -int*2 : int;
    }
  })
  .string('killed', {
    length: 'a_length',
    encoding: 'hex',
    stripNull: 'true',
    formatter: function(str) {
      if(/0000$/.test(str)) {
        return new Buffer(str, 'hex').toString('ucs2').replace(/\u0000$/, '');
      }
      return new Buffer(str, 'hex').toString('utf8').replace(/\u0000$/, '');
    }
  })
  .int32('b_length', {
    formatter: function(int) {
      return int < 0 ? -int*2 : int;
    }
  })
  .string('killer', {
    length: 'b_length',
    encoding: 'hex',
    stripNull: 'true',
    formatter: function(str) {
      if(/0000$/.test(str)) {
        return new Buffer(str, 'hex').toString('ucs2').replace(/\u0000$/, '');
      }
      return new Buffer(str, 'hex').toString('utf8').replace(/\u0000$/, '');
    }
  })
  .uint8('type')
  .uint32('knocked', {
    formatter: function(byte) {
      return byte == 1;
    }
  })
  
const PlayerElimNew = new Parser()
  .endianess('little')
  .skip(87)
  .string('killed', {
    length: 16,
    encoding: 'hex',
    stripNull: 'true',
  })
  .skip(2)
  .string('killer', {
    length: 16,
    encoding: 'hex',
    stripNull: 'true',
  })
  .uint8('type')
  .uint32('knocked', {
    formatter: function(byte) {
      return byte == 1;
    }
  })

const CheckpointHeader = new Parser()
  .endianess('little')


const parser = {
  ReplayParser: ReplayParser,
  Header: HeaderChunk,
  ReplayData: ReplayDataChunk,
  Checkpoint: CheckpointChunk,
  Event: EventChunk,

  MatchTeamStats: MatchTeamStats,
  MatchStats: MatchStats,
  PlayerElimOld: PlayerElimOld,
  PlayerElimNew: PlayerElimNew,

  CheckpointHeader: CheckpointHeader,
};

const parse = function(buffer) {
  let data = ReplayParser.parse(buffer);
  let engineNetworkVersion = 0;
  let changelist = 0;

  // Header cleanup
  data.header.LengthInMS = {
    ms: data.header.LengthInMS,
    string: utils.msToInterval(data.header.LengthInMS)
  };
  delete data.header.FriendlyNameSize;
  data.header.FriendlyName = data.header.FriendlyName.trim();
  // data.header.Timestamp = bignum(
  //   bignum.fromBuffer(data.header.Timestamp, { endian: 'little', size: 8  })
  //   .sub(bignum('621355968000000000'))
  //   ).div(10000);
  // data.header.Timestamp = new Date(data.header.Timestamp.toNumber());

  // Chunks cleanup
  data.chunks = data.chunks.map((chunk) => {
    chunk.ChunkType = ELocalFileChunkType[chunk.ChunkType];
    chunk.res = parser[chunk.ChunkType].parse(chunk.buffer);

    if (chunk.ChunkType == ELocalFileChunkType[0]) {
      engineNetworkVersion = chunk.res.EngineNetworkVersion;
      changelist = chunk.res.changelist;
    }

    if(chunk.res.metadata == 'AthenaMatchTeamStats') {
      chunk.res.res = parser.MatchTeamStats.parse(chunk.res.buffer);
      delete chunk.res.buffer;
    } else if(chunk.res.metadata == 'AthenaMatchStats') {
      chunk.res.res = parser.MatchStats.parse(chunk.res.buffer);
      delete chunk.res.buffer;
    } else if(chunk.res.group == 'playerElim') {
      if (engineNetworkVersion < 11 && changelist < 6573057) {
        chunk.res.res = parser.PlayerElimOld.parse(chunk.res.buffer);
      } else {
        chunk.res.res = parser.PlayerElimNew.parse(chunk.res.buffer);        
      }
      delete chunk.res.buffer;
      delete chunk.res.res.a_length;
      delete chunk.res.res.b_length;
    }else if(chunk.res.group == 'checkpoint' && chunk.res.buffer) {
      chunk.res.res = parser.CheckpointHeader.parse(chunk.res.buffer);
    }

    if(chunk.res.buffer && chunk.res.buffer.length === 0) {
      delete chunk.res.buffer;
    }
    if(chunk.res.buffer) {
      chunk.res.buffer = chunk.res.buffer.length;
    }
    chunk.buffer = chunk.buffer.length;
    return chunk;
  });

  return data;
}

module.exports = {
  parse: parse,
};