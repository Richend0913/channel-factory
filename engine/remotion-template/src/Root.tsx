import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import timingData from "../public/audio/timing.json";

const lastItem = timingData[timingData.length - 1];
const totalDurationSec = lastItem.audioOffsetSec + lastItem.durationSec + 2;
const FPS = 30;
const totalFrames = Math.ceil(totalDurationSec * FPS);

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
    </>
  );
};
