import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

import {
  getPlayList,
  mixPlayList,
} from '../services/youtube-mix-playlist.service';
import {
  createFoldersInCaseNotExistsOnPath,
  removeFileProcessed,
  removeFolderProcessed,
} from '../helpers/data';
import { v4 as uuid } from 'uuid';

export const getYTMixPlaylist = async (req: Request, res: Response) => {
  const searchParams = req.query;
  const listId = searchParams?.listId as string;
  const baseVideoId = searchParams?.baseVideoId as string;

  try {    
    const playlistUI = await getPlayList(baseVideoId, listId);
    const operationIdAssigned = uuid();

    res.status(200).send({
      playlistUI,
      operationId: operationIdAssigned,
    });
  } catch (error) {
    console.log('error:', error);
    res.status(500).send({
      error: (error as Error).message,
    });
  }
};

export const mixYTPlaylist = async (req: Request, res: Response) => {
  const userId = req.headers?.userid as string;
  const operationId = req.headers?.operationid as string;

  const io = req.app.get('io');
  const sockets = req.app.get('sockets');
  const socketId = sockets[userId];
  const socketInstance = io.to(socketId);

  const body = req.body;
  const videoIds = body.videoIds;
  const fileNames = body.fileNames;
  const extension = body.extension;

  const ytdlUserBasePath = path.join('files', `ytdl_${userId}_${operationId}`);
  

  createFoldersInCaseNotExistsOnPath(ytdlUserBasePath);
  const zipFileName = `exported_${userId}_${operationId}.zip`;
  const output = fs.createWriteStream(zipFileName);
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Set compression level
  });

  output.on('close', () => {
    // Once the archive is finalized, send the zip file to the response
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.download(zipFileName, (err) => {
      // Cleanup after sending the file
      fs.unlink(zipFileName, (unlinkError) => {
        if (unlinkError) {
          console.error('Error deleting zip file:', unlinkError);
        }
      });
      if (err) {
        console.error('Error sending zip file:', err);
      }
    });
  });

  archive.pipe(output);
  try {
  let counter=0;
  for (const videoId of videoIds) {
 
    const downloadedUserPath = path.join(
      ytdlUserBasePath,
      `ytdl_${videoId}.${extension}`
    );
    
    await mixPlayList(
      videoId,
      ytdlUserBasePath,
      downloadedUserPath,
      extension,
      socketInstance,
      operationId
    );
 console.log(ytdlUserBasePath);
 archive.append(fs.createReadStream(downloadedUserPath), { name: `${fileNames[counter]}.${extension}` });
 counter++;
 console.log(counter+'/'+videoIds.length);    
  output.on('close', () => {
  removeFolderProcessed(ytdlUserBasePath);
  removeFileProcessed(downloadedUserPath);
     });
  }
    archive.finalize();    
    
  } catch (error) {
    console.log('error:', error);
    // removeFolderProcessed(ytdlUserBasePath);
    // removeFileProcessed(downloadedUserPath);
    res.status(500).send({
      error: (error as Error).message,
    });
  }  
};
