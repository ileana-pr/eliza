import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";

const randomEmotionProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        const emotions = {
            happy: _runtime.character.name + " is feeling cheerful and optimistic",
            sad: _runtime.character.name + " is experiencing melancholy and gloom",
            excited: _runtime.character.name + " is bubbling with enthusiasm and energy",
            anxious: _runtime.character.name + " is filled with worry and unease",
            peaceful: _runtime.character.name + " is in a state of calm tranquility",
            frustrated: _runtime.character.name + " is feeling irritated and annoyed",
            inspired: _runtime.character.name + " is experiencing creative motivation",
            tired: _runtime.character.name + " is feeling low on energy and weary",
            amused: _runtime.character.name + " is finding humor in the situation",
            confused: _runtime.character.name + " is struggling to make sense of things"
        };

        const emotionKeys = Object.keys(emotions);
        const randomKey = emotionKeys[Math.floor(Math.random() * emotionKeys.length)];

        return emotions[randomKey];


    },
};
export { randomEmotionProvider };
