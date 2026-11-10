package com.logdetective.controller;

import com.logdetective.freellm.FreeLlmException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(FreeLlmException.class)
	public ResponseEntity<ApiErrorResponse> handleFreeLlm(FreeLlmException exception) {
		return ResponseEntity.status(exception.getStatus())
			.body(new ApiErrorResponse(exception.getMessage()));
	}

	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<ApiErrorResponse> handleStatus(ResponseStatusException exception) {
		String message = exception.getReason() == null ? "Request failed." : exception.getReason();
		return ResponseEntity.status(exception.getStatusCode())
			.body(new ApiErrorResponse(message));
	}

	public record ApiErrorResponse(String error) {
	}

}
