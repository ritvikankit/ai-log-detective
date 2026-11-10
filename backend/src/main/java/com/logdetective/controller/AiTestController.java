package com.logdetective.controller;

import com.logdetective.freellm.FreeLlmClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ai")
public class AiTestController {

	private final FreeLlmClient freeLlmClient;

	public AiTestController(FreeLlmClient freeLlmClient) {
		this.freeLlmClient = freeLlmClient;
	}

	@PostMapping("/test")
	public AiTestResponse test(@RequestBody AiTestRequest request) {
		if (request == null || request.prompt() == null || request.prompt().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prompt is required.");
		}
		return new AiTestResponse(freeLlmClient.complete(request.prompt()));
	}

	public record AiTestRequest(String prompt) {
	}

	public record AiTestResponse(String text) {
	}

}
