import { Track } from "@/types/music";
import { getStreamUrl } from "./monochromeApi";

/**
 * Downloads a track to the local machine by fetching its audio blob
 * and triggering an anchor tag download.
 */
export async function downloadTrack(track: Track, quality: string = "HIGH") {
    try {
        let url = track.streamUrl;

        // If there's no stream URL but we have a tidal ID, fetch the URL from Monochrome
        if (!url && track.tidalId) {
            url = await getStreamUrl(track.tidalId, quality);
        }

        if (!url) {
            throw new Error("No stream URL available for download");
        }

        // Fetch the audio data as a Blob
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");

        const blob = await response.blob();

        // Create an object URL for the blob
        const blobUrl = window.URL.createObjectURL(blob);

        // Create a temporary anchor element
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = blobUrl;

        // Set the filename
        const extension = getExtensionFromContentType(blob.type) || "m4a";
        const sanitize = (str: string) => str.replace(/[/\\?%*:|"<>]/g, "-").trim();
        const filenameTemplate = localStorage.getItem("download-filename-template") || "{trackNumber} - {artist} - {title}";

        const tokenMap: Record<string, string> = {
            trackNumber: "01",
            artist: track.artist || "Unknown Artist",
            title: track.title || "Unknown Title",
            album: track.album || "Unknown Album",
            year: track.year ? String(track.year) : "",
        };

        const templatedName = filenameTemplate.replace(/\{(\w+)\}/g, (_, token: string) => {
            const value = tokenMap[token] ?? "";
            return sanitize(value);
        });

        const fallbackName = `${sanitize(track.artist || "Unknown Artist")} - ${sanitize(track.title || "Unknown Title")}`;
        const filenameBase = templatedName.replace(/\s+/g, " ").trim() || fallbackName;
        const filename = `${filenameBase}.${extension}`;
        a.download = filename;

        // Trigger the download
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);

        return true;
    } catch (error) {
        console.error("Failed to download track:", error);
        return false;
    }
}

function getExtensionFromContentType(contentType: string) {
    if (contentType.includes("flac")) return "flac";
    if (contentType.includes("mp4") || contentType.includes("m4a")) return "m4a";
    if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
    if (contentType.includes("ogg")) return "ogg";
    if (contentType.includes("wav")) return "wav";
    return null;
}
