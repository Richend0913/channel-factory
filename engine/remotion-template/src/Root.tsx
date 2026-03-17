import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { ShortVideo } from "./ShortVideo";
import timingData from "../public/audio/timing.json";

const lastItem = timingData[timingData.length - 1];
const totalDurationSec = lastItem.audioOffsetSec + lastItem.durationSec + 2;
const FPS = 30;
const totalFrames = Math.ceil(totalDurationSec * FPS);
const shortFrames = 58 * FPS; // 58 seconds for YouTube Shorts

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={totalFrames}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="YouTubeShort"
        component={ShortVideo}
        durationInFrames={shortFrames}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
